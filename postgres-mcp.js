#!/usr/bin/env node
/**
 * postgres-mcp.js — Restricted Postgres MCP server for CrystalClearHouse
 *
 * Security model:
 *   - Connects via MCP_DB_URL which must use the mcp_reader role (SELECT-only)
 *   - Tables accessible only if listed in POSTGRES_ALLOWED_TABLES
 *   - No raw SQL accepted from the model — all queries are built from structured params
 *   - Identifiers (table/column names) validated against /^[a-zA-Z_][a-zA-Z0-9_.]*$/
 *   - Values always passed as parameterized ($1, $2, ...) — no string interpolation
 *   - DDL-pattern detection as a last-resort backstop
 *   - Every tool call audit-logged to .logs/mcp-audit.log
 *
 * Required env vars:
 *   MCP_DB_URL              — connection string for the mcp_reader Postgres role
 *                             (never the service role or anon key connection)
 *   POSTGRES_ALLOWED_TABLES — comma-separated list of tables to expose
 *
 * Optional env vars:
 *   POSTGRES_MAX_ROWS       — hard cap on rows returned (default 100, max 500)
 */

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import pg from "pg";
import dotenv from "dotenv";
import { withAudit } from "./mcp-audit.js";

dotenv.config();

const SERVER_NAME = "postgres";
const { Pool } = pg;

// ── Config ──────────────────────────────────────────────────────────────────

const DB_URL = process.env.MCP_DB_URL;

const ALLOWED_TABLES = (process.env.POSTGRES_ALLOWED_TABLES || "")
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);

const MAX_ROWS = Math.min(Number(process.env.POSTGRES_MAX_ROWS || 100), 500);

// Blocked SQL keywords — backstop against any raw SQL that might slip through
const DDL_PATTERN = /\b(drop|delete|truncate|alter|insert|update|create|grant|revoke|exec|execute|pg_|xp_)\b/i;

// ── Startup guards ───────────────────────────────────────────────────────────

if (!DB_URL) {
  process.stderr.write(
    "ERROR: MCP_DB_URL is required.\n" +
    "       Set it to a postgresql://mcp_reader:...@... connection string.\n" +
    "       Never use the Supabase service role key here.\n"
  );
  process.exit(1);
}

if (ALLOWED_TABLES.length === 0) {
  process.stderr.write(
    "ERROR: POSTGRES_ALLOWED_TABLES is empty.\n" +
    "       Set it to a comma-separated list of tables, e.g.:\n" +
    "       POSTGRES_ALLOWED_TABLES=posts,profiles,scheduled_content\n"
  );
  process.exit(1);
}

// ── DB pool ──────────────────────────────────────────────────────────────────

const pool = new Pool({ connectionString: DB_URL, max: 3 });

pool.on("error", (err) => {
  process.stderr.write(`[postgres-mcp] pool error: ${err.message}\n`);
});

// ── Guards ───────────────────────────────────────────────────────────────────

function assertTableAllowed(table) {
  if (!ALLOWED_TABLES.includes(table)) {
    throw new Error(
      `Table "${table}" is not in POSTGRES_ALLOWED_TABLES ` +
      `(${ALLOWED_TABLES.join(", ")})`
    );
  }
}

function assertSafeIdentifier(id) {
  if (!/^[a-zA-Z_][a-zA-Z0-9_.]*$/.test(id)) {
    throw new Error(`Unsafe identifier rejected: "${id}"`);
  }
}

function assertNoDDL(value) {
  if (DDL_PATTERN.test(String(value))) {
    throw new Error(`Blocked: value contains disallowed SQL keyword`);
  }
}

// ── Server ───────────────────────────────────────────────────────────────────

const server = new McpServer({ name: SERVER_NAME, version: "1.0.0" });

function auditedTool(name, desc, schema, handler) {
  server.tool(name, desc, schema, (args) =>
    withAudit(SERVER_NAME, name, args, () => handler(args))
  );
}

// ── Tool: list_tables ────────────────────────────────────────────────────────

auditedTool(
  "list_tables",
  "List all tables accessible through this MCP server.",
  {},
  async () => ({
    content: [{ type: "text", text: ALLOWED_TABLES.join("\n") }],
  })
);

// ── Tool: describe_table ─────────────────────────────────────────────────────

auditedTool(
  "describe_table",
  "Get column names, data types, and nullability for an allowed table.",
  {
    table_name: z.string().describe("Table name (must be in the allow-list)"),
  },
  async ({ table_name }) => {
    assertTableAllowed(table_name);
    assertSafeIdentifier(table_name);

    const result = await pool.query(
      `SELECT column_name, data_type, is_nullable
       FROM information_schema.columns
       WHERE table_name = $1 AND table_schema = 'public'
       ORDER BY ordinal_position`,
      [table_name]
    );

    const text = result.rows
      .map((r) => `${r.column_name}  ${r.data_type}  (nullable: ${r.is_nullable})`)
      .join("\n");

    return { content: [{ type: "text", text: text || "No columns found." }] };
  }
);

// ── Tool: select_rows ────────────────────────────────────────────────────────

auditedTool(
  "select_rows",
  "SELECT rows from an allowed table. Supports column selection, one equality filter, ORDER BY, and LIMIT. No raw SQL accepted.",
  {
    table_name:   z.string().describe("Table name (must be in allow-list)"),
    columns:      z.array(z.string()).optional().describe("Columns to return — omit for all"),
    where_column: z.string().optional().describe("Column to filter on (simple equality only)"),
    where_value:  z.string().optional().describe("Value to match on where_column"),
    order_by:     z.string().optional().describe("Column to sort by"),
    order_dir:    z.enum(["ASC", "DESC"]).default("ASC").describe("Sort direction"),
    limit:        z.number().int().min(1).max(MAX_ROWS).default(20)
                   .describe(`Max rows to return (hard cap: ${MAX_ROWS})`),
  },
  async ({ table_name, columns, where_column, where_value, order_by, order_dir, limit }) => {
    assertTableAllowed(table_name);
    assertSafeIdentifier(table_name);

    // Build SELECT list
    const colList = columns?.length
      ? columns.map((c) => { assertSafeIdentifier(c); return `"${c}"`; }).join(", ")
      : "*";

    let query = `SELECT ${colList} FROM "${table_name}"`;
    const params = [];

    // WHERE (single equality only — value always parameterized)
    if (where_column !== undefined && where_value !== undefined) {
      assertSafeIdentifier(where_column);
      assertNoDDL(where_value);
      params.push(where_value);
      query += ` WHERE "${where_column}" = $${params.length}`;
    }

    // ORDER BY
    if (order_by) {
      assertSafeIdentifier(order_by);
      query += ` ORDER BY "${order_by}" ${order_dir === "DESC" ? "DESC" : "ASC"}`;
    }

    // LIMIT — always integer, always capped
    query += ` LIMIT ${Math.min(limit, MAX_ROWS)}`;

    const result = await pool.query(query, params);
    return {
      content: [{
        type: "text",
        text: JSON.stringify(result.rows, null, 2),
      }],
    };
  }
);

// ── Tool: count_rows ─────────────────────────────────────────────────────────

auditedTool(
  "count_rows",
  "Count rows in an allowed table, optionally filtered by one equality condition.",
  {
    table_name:   z.string().describe("Table name (must be in allow-list)"),
    where_column: z.string().optional().describe("Column to filter on"),
    where_value:  z.string().optional().describe("Value to match"),
  },
  async ({ table_name, where_column, where_value }) => {
    assertTableAllowed(table_name);
    assertSafeIdentifier(table_name);

    let query = `SELECT COUNT(*) AS count FROM "${table_name}"`;
    const params = [];

    if (where_column !== undefined && where_value !== undefined) {
      assertSafeIdentifier(where_column);
      assertNoDDL(where_value);
      params.push(where_value);
      query += ` WHERE "${where_column}" = $${params.length}`;
    }

    const result = await pool.query(query, params);
    return {
      content: [{
        type: "text",
        text: `${table_name}: ${result.rows[0].count} rows`,
      }],
    };
  }
);

// ── Start ────────────────────────────────────────────────────────────────────

const transport = new StdioServerTransport();
await server.connect(transport);
