-- Migration 002: call_history and restaurant_orders
-- Run against both Supabase (dev) and RDS Aurora (prod).
-- Idempotent — safe to re-run.

-- ─────────────────────────────────────────────────────────────────────────────
-- call_history
--   Persists Sophie's per-call conversation history so restarts don't lose
--   multi-turn context. Keyed by Twilio CallSid.
--   voice-server reads on first turn, upserts after each turn, deletes on hangup.
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS call_history (
  call_sid    TEXT PRIMARY KEY,
  messages    JSONB        NOT NULL DEFAULT '[]',
  created_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

-- Auto-delete stale rows after 24 h via pg_cron (optional; voice-server also
-- deletes on Twilio status callback).
-- To enable: SELECT cron.schedule('prune-call-history', '0 * * * *',
--   $$DELETE FROM call_history WHERE updated_at < NOW() - INTERVAL '24 hours'$$);

-- ─────────────────────────────────────────────────────────────────────────────
-- restaurant_orders
--   Durable log of all orders recorded by crew-service /crew/record_order.
--   The Python service currently uses in-memory list; add a DB write here
--   when ready for full persistence.
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS restaurant_orders (
  id                   SERIAL       PRIMARY KEY,
  confirmation_number  TEXT         NOT NULL UNIQUE,
  customer_phone       TEXT         NOT NULL,
  call_id              TEXT,
  items                JSONB        NOT NULL,
  pickup_time          TEXT,
  estimated_intent     TEXT         NOT NULL DEFAULT 'place_order',
  order_summary        TEXT,
  recorded_at          TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_restaurant_orders_phone
  ON restaurant_orders (customer_phone);

CREATE INDEX IF NOT EXISTS idx_restaurant_orders_recorded_at
  ON restaurant_orders (recorded_at DESC);

-- ─────────────────────────────────────────────────────────────────────────────
-- webhook_errors
--   Dead-letter log used by the Webhook Dead Letter Handler workflow (unprocessed-05).
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS webhook_errors (
  id            SERIAL       PRIMARY KEY,
  workflow_id   TEXT,
  workflow_name TEXT,
  error_message TEXT,
  payload       JSONB,
  failed_at     TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

-- ─────────────────────────────────────────────────────────────────────────────
-- tiktok_analytics
--   Daily video stats snapshots used by TikTok Analytics Ingestion (unprocessed-06)
--   and the Sophie Daily TikTok Report.
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS tiktok_analytics (
  id             SERIAL       PRIMARY KEY,
  video_id       TEXT         NOT NULL,
  snapshot_date  DATE         NOT NULL,
  title          TEXT,
  view_count     BIGINT       DEFAULT 0,
  like_count     BIGINT       DEFAULT 0,
  comment_count  BIGINT       DEFAULT 0,
  share_count    BIGINT       DEFAULT 0,
  created_at     TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  UNIQUE (video_id, snapshot_date)
);

-- ─────────────────────────────────────────────────────────────────────────────
-- MCP reader grant — extend 001_mcp_reader_role grants to new tables
-- ─────────────────────────────────────────────────────────────────────────────

GRANT SELECT ON call_history       TO mcp_reader;
GRANT SELECT ON restaurant_orders  TO mcp_reader;
GRANT SELECT ON webhook_errors     TO mcp_reader;
GRANT SELECT ON tiktok_analytics   TO mcp_reader;
