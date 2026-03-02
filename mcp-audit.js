/**
 * mcp-audit.js — Shared MCP tool-call audit logger
 *
 * Usage in any Node MCP server:
 *   import { withAudit } from './mcp-audit.js';   // from project root
 *   import { withAudit } from '../mcp-audit.js';  // from a subdirectory
 *
 * Records one JSON line per tool call to .logs/mcp-audit.log:
 *   {"ts":"...","server":"social-media","tool":"facebook_post","args_hash":"a1b2c3","status":"ok"}
 */

import { appendFileSync, mkdirSync } from 'fs';
import { createHash } from 'crypto';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const PROJECT_ROOT = dirname(fileURLToPath(import.meta.url));
const LOG_DIR  = join(PROJECT_ROOT, '.logs');
const LOG_FILE = join(LOG_DIR, 'mcp-audit.log');

/**
 * Hash tool arguments so we get a fingerprint without logging sensitive values.
 * Only the hash is stored — never raw arg values.
 */
function argsHash(args) {
  return createHash('sha256')
    .update(JSON.stringify(args ?? {}))
    .digest('hex')
    .slice(0, 12);
}

/**
 * Append one audit record to .logs/mcp-audit.log.
 * Never throws — logging failure must never crash the MCP server.
 */
function auditLog({ server, tool, args, status, error }) {
  try {
    mkdirSync(LOG_DIR, { recursive: true });
    const record = {
      ts:        new Date().toISOString(),
      server,
      tool,
      args_hash: argsHash(args),
      status,
      ...(error ? { error: String(error).slice(0, 200) } : {}),
    };
    appendFileSync(LOG_FILE, JSON.stringify(record) + '\n');
  } catch {
    // intentionally swallowed
  }
}

/**
 * Wrap a tool handler with audit logging.
 *
 * @param {string}   server  - MCP server name (e.g. "social-media")
 * @param {string}   tool    - Tool name (e.g. "facebook_post")
 * @param {object}   args    - Raw args object (only hash is stored)
 * @param {Function} fn      - Async handler to call
 * @returns {*} whatever fn returns
 * @throws  re-throws any error from fn after logging it
 */
export async function withAudit(server, tool, args, fn) {
  try {
    const result = await fn();
    auditLog({ server, tool, args, status: 'ok' });
    return result;
  } catch (err) {
    auditLog({ server, tool, args, status: 'error', error: err.message });
    throw err;
  }
}
