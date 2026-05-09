/**
 * Golf Course EOM Tracker — runtime session driver
 *
 * Triggered by n8n on the 1st of each month (or run manually).
 * Loads AGENT_ID + ENVIRONMENT_ID from env, starts a session, handles the
 * query_purchases custom tool by querying Supabase directly, then downloads
 * the finished DOCX report.
 *
 * Required env vars:
 *   ANTHROPIC_API_KEY
 *   AGENT_ID              — from: ant beta:agents create < agent.yaml --transform id -r
 *   ENVIRONMENT_ID        — from: ant beta:environments create < environment.yaml --transform id -r
 *   MCP_DB_URL            — postgresql://mcp_reader:...@.../postgres
 *   POSTGRES_ALLOWED_TABLES — comma-separated list of allowed tables
 *
 * Optional:
 *   REPORT_MONTH          — 1-12  (defaults to previous month)
 *   REPORT_YEAR           — YYYY  (defaults to current year, adjusted for month)
 *   GOLF_COURSE_CLIENT_ID — filter purchases by a specific client
 *   OUTPUT_DIR            — local dir to save the report (default: ./reports)
 */

import Anthropic from "@anthropic-ai/sdk";
import pg from "pg";
import fs from "fs";
import path from "path";

const client = new Anthropic();
const { Pool } = pg;

// ── Config ───────────────────────────────────────────────────────────────────

const AGENT_ID = process.env.AGENT_ID;
const ENVIRONMENT_ID = process.env.ENVIRONMENT_ID;
const OUTPUT_DIR = process.env.OUTPUT_DIR ?? "./reports";

if (!AGENT_ID || !ENVIRONMENT_ID) {
  console.error("AGENT_ID and ENVIRONMENT_ID must be set.");
  console.error(
    "Run the one-time setup commands in the SETUP section of this file."
  );
  process.exit(1);
}

// Determine the report month/year (defaults to previous calendar month)
function resolveReportPeriod(): { month: number; year: number } {
  if (process.env.REPORT_MONTH && process.env.REPORT_YEAR) {
    return {
      month: parseInt(process.env.REPORT_MONTH, 10),
      year: parseInt(process.env.REPORT_YEAR, 10),
    };
  }
  const now = new Date();
  const month = now.getMonth() === 0 ? 12 : now.getMonth(); // getMonth() is 0-based
  const year =
    now.getMonth() === 0 ? now.getFullYear() - 1 : now.getFullYear();
  return { month, year };
}

// ── Supabase query (runs host-side — credentials never enter the container) ──

const pool = new Pool({ connectionString: process.env.MCP_DB_URL });

const ALLOWED_TABLES = new Set(
  (process.env.POSTGRES_ALLOWED_TABLES ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean)
);

interface PurchaseRecord {
  id: string;
  date: string;
  description: string;
  category: string;
  amount: number;
  cost: number | null;
  client_id?: string;
}

async function queryPurchases(
  month: number,
  year: number,
  clientId?: string
): Promise<PurchaseRecord[]> {
  // Determine the purchases table name — must be in the allow-list
  const table = "purchases";
  if (!ALLOWED_TABLES.has(table)) {
    throw new Error(
      `Table "${table}" is not in POSTGRES_ALLOWED_TABLES. Add it to the env var.`
    );
  }

  const startDate = `${year}-${String(month).padStart(2, "0")}-01`;
  const endDate = new Date(year, month, 1).toISOString().slice(0, 10); // first day of next month

  const params: (string | number)[] = [startDate, endDate];
  let where = "date >= $1 AND date < $2";

  if (clientId) {
    params.push(clientId);
    where += ` AND client_id = $${params.length}`;
  }

  const sql = `
    SELECT id, date, description, category, amount, cost, client_id
    FROM purchases
    WHERE ${where}
    ORDER BY date ASC
    LIMIT 500
  `;

  const result = await pool.query(sql, params);
  return result.rows as PurchaseRecord[];
}

// ── Main session loop ─────────────────────────────────────────────────────────

async function run() {
  const { month, year } = resolveReportPeriod();
  const monthName = new Date(year, month - 1, 1).toLocaleString("en-US", {
    month: "long",
  });

  console.log(`\n📊 Generating EOM report for ${monthName} ${year}...`);

  // Create session
  const session = await client.beta.sessions.create({
    agent: AGENT_ID!,
    environment_id: ENVIRONMENT_ID!,
    title: `EOM Report — ${monthName} ${year}`,
  });
  console.log(`Session: ${session.id}`);

  // Stream-first, then send the kickoff message
  const stream = await client.beta.sessions.events.stream(session.id);

  const kickoffText = process.env.GOLF_COURSE_CLIENT_ID
    ? `Generate the EOM profit report for ${monthName} ${year} for client ${process.env.GOLF_COURSE_CLIENT_ID}.`
    : `Generate the EOM profit report for ${monthName} ${year}.`;

  await client.beta.sessions.events.send(session.id, {
    events: [
      {
        type: "user.message",
        content: [{ type: "text", text: kickoffText }],
      },
    ],
  });

  // Drain the event stream
  for await (const event of stream) {
    switch (event.type) {
      case "agent.message":
        for (const block of event.content) {
          if (block.type === "text") process.stdout.write(block.text);
        }
        break;

      case "agent.thinking":
        // Suppress thinking blocks in console output
        break;

      // Handle the query_purchases custom tool call (host-side execution)
      case "agent.custom_tool_use": {
        if (event.name !== "query_purchases") {
          console.warn(`\nUnknown custom tool: ${event.name}`);
          await client.beta.sessions.events.send(session.id, {
            events: [
              {
                type: "user.custom_tool_result",
                custom_tool_use_id: event.id,
                content: [
                  { type: "text", text: `Unknown tool: ${event.name}` },
                ],
                is_error: true,
              },
            ],
          });
          break;
        }

        const input = event.input as {
          month: number;
          year: number;
          client_id?: string;
        };
        console.log(
          `\n🔍 Querying purchases: ${input.month}/${input.year}${input.client_id ? ` (client: ${input.client_id})` : ""}...`
        );

        try {
          const records = await queryPurchases(
            input.month,
            input.year,
            input.client_id
          );
          console.log(`   Found ${records.length} records.`);

          await client.beta.sessions.events.send(session.id, {
            events: [
              {
                type: "user.custom_tool_result",
                custom_tool_use_id: event.id,
                content: [
                  { type: "text", text: JSON.stringify(records, null, 2) },
                ],
              },
            ],
          });
        } catch (err) {
          const msg = err instanceof Error ? err.message : String(err);
          console.error(`\n❌ DB query failed: ${msg}`);
          await client.beta.sessions.events.send(session.id, {
            events: [
              {
                type: "user.custom_tool_result",
                custom_tool_use_id: event.id,
                content: [{ type: "text", text: `Error: ${msg}` }],
                is_error: true,
              },
            ],
          });
        }
        break;
      }

      case "session.status_idle":
        if (event.stop_reason?.type !== "requires_action") {
          // Agent finished — download the report
          await downloadReport(session.id, month, year);
          return;
        }
        break;

      case "session.status_terminated":
        console.error("\n❌ Session terminated unexpectedly.");
        return;

      case "session.error":
        console.error(`\n❌ Session error: ${JSON.stringify(event)}`);
        break;
    }
  }
}

// ── Download the generated DOCX from session outputs ─────────────────────────

async function downloadReport(
  sessionId: string,
  month: number,
  year: number
): Promise<void> {
  console.log("\n\n📥 Downloading report...");

  await fs.promises.mkdir(OUTPUT_DIR, { recursive: true });

  // Brief pause for indexing lag (~1-3s after session goes idle)
  await new Promise((r) => setTimeout(r, 2000));

  const files = await client.beta.files.list({
    scope_id: sessionId,
    betas: ["managed-agents-2026-04-01"],
  } as Parameters<typeof client.beta.files.list>[0]);

  const docxFiles = files.data.filter((f) =>
    f.filename.endsWith(".docx")
  );

  if (docxFiles.length === 0) {
    console.warn("⚠️  No .docx output file found in session outputs.");
    return;
  }

  for (const f of docxFiles) {
    const safeName = path.basename(f.filename);
    const outputPath = path.join(OUTPUT_DIR, safeName);
    const resp = await client.beta.files.download(f.id);
    const buffer = Buffer.from(await resp.arrayBuffer());
    await fs.promises.writeFile(outputPath, buffer);
    console.log(`✅ Report saved: ${outputPath}`);
  }

  // Archive session after successful download
  await client.beta.sessions.archive(sessionId);
  console.log("   Session archived.");
}

// ── Entry point ───────────────────────────────────────────────────────────────

run()
  .catch((err) => {
    console.error("Fatal error:", err);
    process.exit(1);
  })
  .finally(() => pool.end());
