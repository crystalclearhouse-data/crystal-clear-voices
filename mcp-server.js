/**
 * CrystalClearHouse Unified MCP Server
 *
 * Supports both transports:
 *   stdio  — for VS Code / Claude Desktop (local)
 *   HTTP   — for Claude.ai Custom Connectors (remote via ngrok or EC2)
 *
 * Usage:
 *   node mcp-server.js          → stdio (default)
 *   node mcp-server.js --http   → HTTP+SSE on PORT (default 3003)
 */

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

dotenv.config();

const PROJECT_ROOT = '/Users/data-house/projects/crystalclearhouse-data';
const MCP_API_KEY  = process.env.MCP_API_KEY || 'cch-mcp-local-dev';

// ── Server factory ───────────────────────────────────────────────────────────

function createServer() {
  const server = new Server(
    { name: 'crystalclearhouse-unified', version: '1.0.0' },
    { capabilities: { resources: {}, tools: {} } }
  );

  // ── Resources ──────────────────────────────────────────────────────────────

  server.setRequestHandler(ListResourcesRequestSchema, async () => {
    const entries = await fs.readdir(PROJECT_ROOT, { withFileTypes: true });
    const files = entries
      .filter(e => e.isFile() && !e.name.startsWith('.'))
      .slice(0, 50);

    return {
      resources: files.map(f => ({
        uri: `file://${PROJECT_ROOT}/${f.name}`,
        name: f.name,
        mimeType: 'text/plain',
      })),
    };
  });

  server.setRequestHandler(ReadResourceRequestSchema, async (req) => {
    const filePath = new URL(req.params.uri).pathname;
    const content = await fs.readFile(filePath, 'utf-8');
    return {
      contents: [{ uri: req.params.uri, mimeType: 'text/plain', text: content }],
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
          properties: { lines: { type: 'number', description: 'Number of commits (default 10)' } },
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

    try {
      if (name === 'git_status') {
        const out = execSync(`git -C ${PROJECT_ROOT} status`, { encoding: 'utf-8' });
        return { content: [{ type: 'text', text: out }] };
      }

      if (name === 'git_log') {
        const n = args.lines || 10;
        const out = execSync(`git -C ${PROJECT_ROOT} log --oneline -${n}`, { encoding: 'utf-8' });
        return { content: [{ type: 'text', text: out }] };
      }

      if (name === 'n8n_workflows') {
        const res = await fetch('http://localhost:5678/api/v1/workflows', {
          headers: { 'X-N8N-API-KEY': process.env.N8N_API_KEY || '' },
        });
        const data = await res.json();
        return { content: [{ type: 'text', text: JSON.stringify(data, null, 2) }] };
      }

      if (name === 'voice_server_health') {
        const res = await fetch('http://localhost:3001/health');
        const data = await res.json();
        return { content: [{ type: 'text', text: JSON.stringify(data, null, 2) }] };
      }

      return { content: [{ type: 'text', text: `Unknown tool: ${name}` }] };
    } catch (err) {
      return { content: [{ type: 'text', text: `Error: ${err.message}` }] };
    }
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
  const PORT = parseInt(process.env.MCP_PORT || '3003', 10);
  const app = express();

  app.use(cors());
  app.use(express.json());

  // Simple API-key auth middleware
  app.use((req, res, next) => {
    // Health check skips auth
    if (req.path === '/health') return next();

    const key = req.headers['x-api-key'] || req.query.api_key;
    if (key !== MCP_API_KEY) {
      return res.status(401).json({ error: 'Invalid API key' });
    }
    next();
  });

  app.get('/health', (_req, res) => {
    res.json({ status: 'ok', server: 'crystalclearhouse-mcp', transport: 'http+sse' });
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

  app.listen(PORT, () => {
    console.log(`\n🔌 CrystalClearHouse MCP Server (HTTP+SSE)`);
    console.log(`   Port     : ${PORT}`);
    console.log(`   API Key  : ${MCP_API_KEY}`);
    console.log(`   SSE      : http://localhost:${PORT}/sse`);
    console.log(`   Health   : http://localhost:${PORT}/health\n`);
    console.log(`   Claude.ai Connector URL:`);
    console.log(`   → Add ngrok URL + /sse to Claude Settings → Connectors\n`);
  });
}

// ── Entry point ───────────────────────────────────────────────────────────────

const useHttp = process.argv.includes('--http');
useHttp ? runHttp() : runStdio();
