import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { SSEServerTransport } from '@modelcontextprotocol/sdk/server/sse.js';
import {
  ListResourcesRequestSchema,
  ReadResourceRequestSchema,
  ListToolsRequestSchema,
  CallToolRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';
import express from 'express';
import cors from 'cors';
import fs from 'fs/promises';
import { execSync } from 'child_process';
import dotenv from 'dotenv';
import { withAudit } from './mcp-audit.js';
import { DEFAULT_PROJECT_ROOT, resolveUnderRoot } from './mcp-paths.js';
import path from 'path';

dotenv.config();

export const PROJECT_ROOT = DEFAULT_PROJECT_ROOT;

const SERVER_NAME = 'crystalclearhouse-unified';

// HTTP mode requires an explicit key — no fallback, no default
const MCP_API_KEY = process.env.MCP_API_KEY;

// Origins allowed to connect to the HTTP transport
const CORS_ALLOWED_ORIGINS = [
  'http://localhost:3000',
  'http://localhost:3001',
  'http://localhost:3003',
  'http://localhost:5678',
  'http://127.0.0.1:3000',
  'http://127.0.0.1:3001',
  'http://127.0.0.1:3003',
];

// ── Server factory ───────────────────────────────────────────────────────────

function createServer() {
  const server = new Server(
    { name: SERVER_NAME, version: '1.0.0' },
    { capabilities: { resources: {}, tools: {} } }
  );

  // ── Resources ──────────────────────────────────────────────────────────────

  server.setRequestHandler(ListResourcesRequestSchema, async () => {
    const entries = await fs.readdir(PROJECT_ROOT, { withFileTypes: true });
    const files = entries
      .filter((e) => e.isFile() && !e.name.startsWith('.'))
      .slice(0, 50);

    return {
      resources: files.map((f) => {
        const fullPath = path.join(PROJECT_ROOT, f.name);
        return {
          uri: `file://${fullPath}`,
          name: f.name,
          mimeType: 'text/plain',
        };
      }),
    };
  });

  server.setRequestHandler(ReadResourceRequestSchema, async (req) => {
    const fileUrl = new URL(req.params.uri);
    const filePath = resolveUnderRoot(PROJECT_ROOT, fileUrl.pathname);
    const content = await fs.readFile(filePath, 'utf-8');
    return {
      contents: [
        {
          uri: req.params.uri,
          mimeType: 'text/plain',
          text: content,
        },
      ],
    };
  });

  // ── Tools ──────────────────────────────────────────────────────────────────

  server.setRequestHandler(ListToolsRequestSchema, async () => ({
    tools: [
      {
        name: 'git_status',
        description: 'Get git status of the CrystalClearHouse project',
        inputSchema: { type: 'object', properties: {} },
      },
      {
        name: 'git_log',
        description: 'Get recent git commits',
        inputSchema: {
          type: 'object',
          properties: {
            lines: {
              type: 'number',
              description: 'Number of commits (default 10)',
            },
          },
        },
      },
      {
        name: 'n8n_workflows',
        description: 'List all n8n workflows',
        inputSchema: { type: 'object', properties: {} },
      },
      {
        name: 'voice_server_health',
        description: 'Check Sophie voice server health and pipeline status',
        inputSchema: { type: 'object', properties: {} },
      },
    ],
  }));

  server.setRequestHandler(CallToolRequestSchema, async (req) => {
    const { name, arguments: args = {} } = req.params;

    return withAudit(SERVER_NAME, name, args, async () => {
      if (name === 'git_status') {
        const out = execSync(
          `git -C "${PROJECT_ROOT}" status`,
          { encoding: 'utf-8' }
        );
        return { content: [{ type: 'text', text: out }] };
      }

      if (name === 'git_log') {
        const n = Math.min(Number(args.lines) || 10, 50); // cap at 50
        const out = execSync(
          `git -C "${PROJECT_ROOT}" log --oneline -${n}`,
          { encoding: 'utf-8' }
        );
        return { content: [{ type: 'text', text: out }] };
      }

      if (name === 'n8n_workflows') {
        const res = await fetch('http://localhost:5678/api/v1/workflows', {
          headers: { 'X-N8N-API-KEY': process.env.N8N_API_KEY || '' },
        });
        const data = await res.json();
        return {
          content: [{ type: 'text', text: JSON.stringify(data, null, 2) }],
        };
      }

      if (name === 'voice_server_health') {
        const res = await fetch('http://localhost:3001/health');
        const data = await res.json();
        return {
          content: [{ type: 'text', text: JSON.stringify(data, null, 2) }],
        };
      }

      return {
        content: [{ type: 'text', text: `Unknown tool: ${name}` }],
      };
    });
  });

  return server;
}

// ── Transport: stdio (VS Code / Claude Desktop) ──────────────────────────────

async function runStdio() {
  const server = createServer();
  const transport = new StdioServerTransport();
  await server.connect(transport);
  // stdio — silent, no console output
}

// ── Transport: HTTP + SSE (Claude.ai Custom Connectors / remote) ─────────────

async function runHttp() {
  if (!MCP_API_KEY) {
    console.error('ERROR: MCP_API_KEY env var is required in HTTP mode.');
    console.error('       Set it in voice-server/.env or export it in your shell.');
    process.exit(1);
  }

  const PORT = parseInt(process.env.MCP_PORT || '3003', 10);
  const app = express();

  app.use(
    cors({
      origin: (origin, callback) => {
        // Allow requests with no origin (curl, server-to-server)
        if (!origin || CORS_ALLOWED_ORIGINS.includes(origin)) {
          callback(null, true);
        } else {
          callback(new Error(`CORS: origin ${origin} not allowed`));
        }
      },
      methods: ['GET', 'POST'],
      allowedHeaders: ['Content-Type', 'x-api-key'],
    })
  );

  app.use(express.json());

  // API-key auth — skip health check
  app.use((req, res, next) => {
    if (req.path === '/health') return next();
    const key = req.headers['x-api-key'] || req.query.api_key;
    if (key !== MCP_API_KEY) {
      return res.status(401).json({ error: 'Invalid API key' });
    }
    next();
  });

  app.get('/health', (_req, res) => {
    res.json({ status: 'ok', server: SERVER_NAME, transport: 'http+sse' });
  });

  // SSE endpoint — each connection gets its own server instance
  const transports = new Map();

  app.get('/sse', async (req, res) => {
    const transport = new SSEServerTransport('/messages', res);
    const server = createServer();
    transports.set(transport.sessionId, transport);
    res.on('close', () => transports.delete(transport.sessionId));
    await server.connect(transport);
  });

  app.post('/messages', async (req, res) => {
    const sessionId = req.query.sessionId;
    const transport = transports.get(sessionId);
    if (!transport) return res.status(404).json({ error: 'Session not found' });
    await transport.handlePostMessage(req, res);
  });

  // Bind to 127.0.0.1 — never exposed directly to the network
  app.listen(PORT, '127.0.0.1', () => {
    console.log(`\n🔌 CrystalClearHouse MCP Server (HTTP+SSE)`);
    console.log(`   Bound    : 127.0.0.1:${PORT}  (localhost only)`);
    console.log(`   SSE      : http://127.0.0.1:${PORT}/sse`);
    console.log(`   Health   : http://127.0.0.1:${PORT}/health`);
    console.log(`   Audit    : .logs/mcp-audit.log\n`);
    console.log(
      `   To expose externally: run ngrok then add the ngrok URL to Claude connectors.\n`
    );
  });
}

// ── Entry point ───────────────────────────────────────────────────────────────

const useHttp = process.argv.includes('--http');
useHttp ? runHttp() : runStdio();
