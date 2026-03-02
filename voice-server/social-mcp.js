#!/usr/bin/env node
/**
 * social-mcp.js — Custom MCP server for The Steele Zone social media accounts
 *
 * Covers: Facebook (the-steele-zone), Instagram (@the-steele-zone), TikTok (@the-steele-zone)
 * Also exposes a cross-post tool that routes through the existing n8n social-media-agent workflow.
 *
 * Tools:
 *   social_post_all       — cross-post to all platforms via n8n webhook
 *   facebook_post         — post to Facebook Page
 *   facebook_get_posts    — list recent posts with engagement
 *   facebook_get_comments — get comments on a post
 *   instagram_post        — post image/video to Instagram
 *   instagram_get_feed    — list recent feed posts with engagement
 *   instagram_get_comments — get comments on a media
 *   tiktok_get_videos     — list recent videos with stats
 *   tiktok_post_video     — post a video (requires public URL)
 */

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { withAudit } from "../mcp-audit.js";

const SERVER_NAME = "social-media";

// ── Config ─────────────────────────────────────────────────────────────────
const {
  META_PAGE_ID = "",
  META_PAGE_ACCESS_TOKEN = "",
  META_IG_USER_ID = "",
  TIKTOK_ACCESS_TOKEN = "",
  TIKTOK_OPEN_ID = "",
  N8N_WEBHOOK_URL = "http://localhost:5678",
} = process.env;

const GRAPH = "https://graph.facebook.com/v21.0";
const TIKTOK = "https://open.tiktokapis.com/v2";

// ── Allow-lists & sanitization ─────────────────────────────────────────────
const ALLOWED_PLATFORMS = (process.env.SOCIAL_ALLOWED_PLATFORMS || "facebook,instagram,tiktok")
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);

const MAX_POST_LENGTH = Number(process.env.SOCIAL_MAX_POST_LENGTH || 1000);

function ensurePlatformAllowed(platform) {
  if (!ALLOWED_PLATFORMS.includes(platform)) {
    throw new Error(`Platform "${platform}" not in SOCIAL_ALLOWED_PLATFORMS (${ALLOWED_PLATFORMS.join(", ")})`);
  }
}

function sanitizeMessage(msg) {
  const text = String(msg || "").trim();
  if (!text) throw new Error("Message cannot be empty");
  return text.length > MAX_POST_LENGTH ? text.slice(0, MAX_POST_LENGTH) : text;
}

function sanitizeHttpsLink(link) {
  if (!link) return undefined;
  const s = String(link).trim();
  try {
    const url = new URL(s);
    if (url.protocol !== "https:") throw new Error("Only https:// links are allowed");
    // Uncomment to restrict to your own domains:
    // const allowedDomains = ["thediscobass.com", "thesteelezone.com", "linkfly.to"];
    // if (!allowedDomains.includes(url.hostname)) throw new Error("Link domain not allowed");
    return url.toString();
  } catch (e) {
    throw new Error(`Invalid link URL: ${e.message}`);
  }
}

// ── Helpers ────────────────────────────────────────────────────────────────
function requireEnv(...vars) {
  const missing = vars.filter((v) => !process.env[v]);
  if (missing.length) {
    throw new Error(`Missing env vars: ${missing.join(", ")}. Set them in voice-server/.env or ~/.zshrc`);
  }
}

async function graphGet(path) {
  const res = await fetch(`${GRAPH}/${path}`);
  const data = await res.json();
  if (!res.ok) throw new Error(data.error?.message || `Graph API ${res.status}`);
  return data;
}

async function graphPost(path, params) {
  const body = new URLSearchParams(params);
  const res = await fetch(`${GRAPH}/${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: body.toString(),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error?.message || `Graph API ${res.status}`);
  return data;
}

async function tiktokRequest(path, body) {
  const res = await fetch(`${TIKTOK}/${path}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${TIKTOK_ACCESS_TOKEN}`,
      "Content-Type": "application/json; charset=UTF-8",
    },
    body: JSON.stringify(body),
  });
  const data = await res.json();
  if (!res.ok || data.error?.code !== "ok") {
    throw new Error(data.error?.message || `TikTok API ${res.status}`);
  }
  return data;
}

function ok(text) {
  return { content: [{ type: "text", text }] };
}

// ── Server ─────────────────────────────────────────────────────────────────
const server = new McpServer({ name: SERVER_NAME, version: "1.0.0" });

/** Wrap server.tool with audit logging */
function auditedTool(name, desc, schema, handler) {
  server.tool(name, desc, schema, (args) =>
    withAudit(SERVER_NAME, name, args, () => handler(args))
  );
}

// ── Tool: social_post_all ──────────────────────────────────────────────────
auditedTool(
  "social_post_all",
  "Cross-post content to all social platforms (Facebook, Instagram, TikTok) via n8n. Requires n8n to be running (scripts/dev-up.sh).",
  {
    message: z.string().describe("Content to post across all platforms"),
    media_url: z.string().optional().describe("Optional public URL to an image or video"),
  },
  async ({ message, media_url }) => {
    const safeMessage = sanitizeMessage(message);
    const safePlatforms = ["facebook", "instagram", "tiktok"].filter((p) => {
      try { ensurePlatformAllowed(p); return true; } catch { return false; }
    });
    if (safePlatforms.length === 0) throw new Error("No allowed platforms configured");
    const safeMediaUrl = media_url ? sanitizeHttpsLink(media_url) : null;
    const payload = {
      content: safeMessage,
      media_url: safeMediaUrl,
      platforms: safePlatforms,
    };
    const res = await fetch(`${N8N_WEBHOOK_URL}/webhook/social-media/post`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const text = await res.text();
    return ok(`n8n cross-post response (HTTP ${res.status}):\n${text}`);
  }
);

// ── Tools: Facebook ────────────────────────────────────────────────────────
auditedTool(
  "facebook_post",
  "Post a message (and optional https:// link) to The Steele Zone Facebook Page.",
  {
    message: z.string().describe("Text content to post"),
    link: z.string().optional().describe("Optional https:// URL to include in the post"),
  },
  async ({ message, link }) => {
    ensurePlatformAllowed("facebook");
    requireEnv("META_PAGE_ID", "META_PAGE_ACCESS_TOKEN");
    const safeMessage = sanitizeMessage(message);
    const safeLink = sanitizeHttpsLink(link);
    const params = { message: safeMessage, access_token: META_PAGE_ACCESS_TOKEN };
    if (safeLink) params.link = safeLink;
    const data = await graphPost(`${META_PAGE_ID}/feed`, params);
    return ok(`Posted to Facebook! Post ID: ${data.id}`);
  }
);

auditedTool(
  "facebook_get_posts",
  "List recent posts from The Steele Zone Facebook Page with like and comment counts.",
  {
    limit: z.number().int().min(1).max(25).default(5).describe("Number of posts to retrieve"),
  },
  async ({ limit }) => {
    requireEnv("META_PAGE_ID", "META_PAGE_ACCESS_TOKEN");
    const fields = "message,story,created_time,likes.summary(true),comments.summary(true)";
    const data = await graphGet(
      `${META_PAGE_ID}/feed?fields=${fields}&limit=${limit}&access_token=${META_PAGE_ACCESS_TOKEN}`
    );
    const posts = (data.data ?? [])
      .map(
        (p) =>
          `[${p.created_time}] ${p.message ?? p.story ?? "(no text)"}\n` +
          `  Likes: ${p.likes?.summary?.total_count ?? 0} | Comments: ${p.comments?.summary?.total_count ?? 0} | ID: ${p.id}`
      )
      .join("\n\n");
    return ok(posts || "No posts found.");
  }
);

auditedTool(
  "facebook_get_comments",
  "Get comments on a specific Facebook post.",
  {
    post_id: z.string().describe("Facebook post ID (e.g. from facebook_get_posts)"),
    limit: z.number().int().min(1).max(50).default(10).describe("Number of comments to retrieve"),
  },
  async ({ post_id, limit }) => {
    requireEnv("META_PAGE_ACCESS_TOKEN");
    const data = await graphGet(
      `${post_id}/comments?fields=from,message,created_time,like_count&limit=${limit}&access_token=${META_PAGE_ACCESS_TOKEN}`
    );
    const comments = (data.data ?? [])
      .map((c) => `[${c.created_time}] ${c.from?.name ?? "Unknown"}: ${c.message} (Likes: ${c.like_count ?? 0})`)
      .join("\n");
    return ok(comments || "No comments found.");
  }
);

// ── Tools: Instagram ───────────────────────────────────────────────────────
auditedTool(
  "instagram_post",
  "Post an image or video to @the-steele-zone Instagram. Media must be at a public HTTPS URL.",
  {
    media_url: z.string().describe("Public HTTPS URL of the image or video"),
    caption: z.string().optional().describe("Caption for the post"),
    media_type: z
      .enum(["IMAGE", "VIDEO", "REELS"])
      .default("IMAGE")
      .describe("Type of media to post"),
  },
  async ({ media_url, caption, media_type }) => {
    ensurePlatformAllowed("instagram");
    requireEnv("META_IG_USER_ID", "META_PAGE_ACCESS_TOKEN");
    const safeMediaUrl = sanitizeHttpsLink(media_url);
    const safeCaption = caption ? sanitizeMessage(caption) : undefined;
    const containerParams = {
      access_token: META_PAGE_ACCESS_TOKEN,
      media_type,
      ...(media_type === "IMAGE" ? { image_url: safeMediaUrl } : { video_url: safeMediaUrl }),
      ...(safeCaption ? { caption: safeCaption } : {}),
    };
    const container = await graphPost(`${META_IG_USER_ID}/media`, containerParams);
    const published = await graphPost(`${META_IG_USER_ID}/media_publish`, {
      creation_id: container.id,
      access_token: META_PAGE_ACCESS_TOKEN,
    });
    return ok(`Posted to Instagram! Media ID: ${published.id}`);
  }
);

auditedTool(
  "instagram_get_feed",
  "List recent posts from @the-steele-zone Instagram with engagement stats and URLs.",
  {
    limit: z.number().int().min(1).max(25).default(5).describe("Number of posts to retrieve"),
  },
  async ({ limit }) => {
    requireEnv("META_IG_USER_ID", "META_PAGE_ACCESS_TOKEN");
    const fields = "id,caption,media_type,timestamp,like_count,comments_count,permalink";
    const data = await graphGet(
      `${META_IG_USER_ID}/media?fields=${fields}&limit=${limit}&access_token=${META_PAGE_ACCESS_TOKEN}`
    );
    const posts = (data.data ?? [])
      .map(
        (p) =>
          `[${p.timestamp}] ${p.media_type} | Likes: ${p.like_count ?? 0} | Comments: ${p.comments_count ?? 0}\n` +
          `  Caption: ${(p.caption ?? "").slice(0, 120)}\n  URL: ${p.permalink}`
      )
      .join("\n\n");
    return ok(posts || "No posts found.");
  }
);

auditedTool(
  "instagram_get_comments",
  "Get comments on a specific Instagram post.",
  {
    media_id: z.string().describe("Instagram media ID (e.g. from instagram_get_feed)"),
    limit: z.number().int().min(1).max(50).default(10).describe("Number of comments to retrieve"),
  },
  async ({ media_id, limit }) => {
    requireEnv("META_PAGE_ACCESS_TOKEN");
    const data = await graphGet(
      `${media_id}/comments?fields=from,text,timestamp&limit=${limit}&access_token=${META_PAGE_ACCESS_TOKEN}`
    );
    const comments = (data.data ?? [])
      .map((c) => `[${c.timestamp}] ${c.from?.username ?? "Unknown"}: ${c.text}`)
      .join("\n");
    return ok(comments || "No comments found.");
  }
);

// ── Tools: TikTok ──────────────────────────────────────────────────────────
auditedTool(
  "tiktok_get_videos",
  "List recent videos from @the-steele-zone TikTok with view, like, comment, and share counts.",
  {
    max_count: z.number().int().min(1).max(20).default(5).describe("Number of videos to retrieve"),
  },
  async ({ max_count }) => {
    requireEnv("TIKTOK_ACCESS_TOKEN");
    const data = await tiktokRequest("video/list/", {
      max_count,
      fields: ["id", "title", "video_description", "create_time", "view_count", "like_count", "comment_count", "share_count"],
    });
    const videos = (data.data?.videos ?? [])
      .map(
        (v) =>
          `[${new Date(v.create_time * 1000).toISOString()}] ${v.title || v.video_description || "(no title)"}\n` +
          `  Views: ${v.view_count ?? 0} | Likes: ${v.like_count ?? 0} | Comments: ${v.comment_count ?? 0} | Shares: ${v.share_count ?? 0}\n  ID: ${v.id}`
      )
      .join("\n\n");
    return ok(videos || "No videos found.");
  }
);

auditedTool(
  "tiktok_post_video",
  "Post a video to @the-steele-zone TikTok via the Content Posting API. Video must be at a public HTTPS URL.",
  {
    video_url: z.string().describe("Public HTTPS URL of the video file"),
    title: z.string().max(150).describe("Title/caption for the video (max 150 characters)"),
    privacy_level: z
      .enum(["PUBLIC_TO_EVERYONE", "MUTUAL_FOLLOW_FRIENDS", "SELF_ONLY"])
      .default("PUBLIC_TO_EVERYONE")
      .describe("Who can see the video"),
    disable_comment: z.boolean().default(false).describe("Disable comments on this video"),
    disable_duet: z.boolean().default(false).describe("Disable duets for this video"),
    disable_stitch: z.boolean().default(false).describe("Disable stitches for this video"),
  },
  async ({ video_url, title, privacy_level, disable_comment, disable_duet, disable_stitch }) => {
    ensurePlatformAllowed("tiktok");
    requireEnv("TIKTOK_ACCESS_TOKEN");
    const safeVideoUrl = sanitizeHttpsLink(video_url);
    const safeTitle = sanitizeMessage(title);
    const data = await tiktokRequest("post/publish/video/init/", {
      post_info: { title: safeTitle, privacy_level, disable_comment, disable_duet, disable_stitch },
      source_info: { source: "PULL_FROM_URL", video_url: safeVideoUrl },
    });
    return ok(
      `TikTok video post initiated!\nPublish ID: ${data.data?.publish_id}\nNote: Video processing may take a few minutes.`
    );
  }
);

// ── Start ──────────────────────────────────────────────────────────────────
const transport = new StdioServerTransport();
await server.connect(transport);
