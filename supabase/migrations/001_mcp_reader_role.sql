-- ============================================================================
-- 001_mcp_reader_role.sql
-- Creates a restricted read-only Postgres role for the postgres-mcp.js server.
--
-- Run once in the Supabase SQL editor (or via psql as a superuser).
-- After running:
--   1. Set MCP_DB_URL in voice-server/.env to the mcp_reader connection string.
--   2. Set POSTGRES_ALLOWED_TABLES to the exact tables you want exposed.
--   3. Never use the service role key or postgres superuser in MCP_DB_URL.
-- ============================================================================

-- 1. Create the role if it doesn't exist
--    Replace 'CHANGE_ME_STRONG_PASSWORD' with a real password before running.
DO $$
BEGIN
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'mcp_reader') THEN
    CREATE ROLE mcp_reader WITH
      LOGIN
      PASSWORD 'CHANGE_ME_STRONG_PASSWORD'
      NOSUPERUSER
      NOCREATEDB
      NOCREATEROLE
      NOREPLICATION;
  END IF;
END
$$;

-- 2. Allow the role to connect to the database
GRANT CONNECT ON DATABASE postgres TO mcp_reader;

-- 3. Allow access to the public schema (read-only)
GRANT USAGE ON SCHEMA public TO mcp_reader;

-- 4. Grant SELECT on the specific tables MCP is allowed to read.
--    Add or remove tables here to control the MCP surface exactly.
--    Examples — uncomment and replace with your real table names:
--
-- GRANT SELECT ON TABLE public.posts             TO mcp_reader;
-- GRANT SELECT ON TABLE public.profiles          TO mcp_reader;
-- GRANT SELECT ON TABLE public.scheduled_content TO mcp_reader;
-- GRANT SELECT ON TABLE public.n8n_audit_events  TO mcp_reader;
-- GRANT SELECT ON TABLE public.mcp_audit_events  TO mcp_reader;

-- 5. Belt-and-suspenders: explicitly revoke all write operations
--    (the role has no GRANT for writes, but this makes the intent explicit)
REVOKE INSERT, UPDATE, DELETE, TRUNCATE
  ON ALL TABLES IN SCHEMA public
  FROM mcp_reader;

-- 6. Prevent mcp_reader from inheriting access to any future tables by default.
--    New tables must be explicitly GRANTed.
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  REVOKE ALL ON TABLES FROM mcp_reader;

-- 7. Revoke access to auth, storage, and other sensitive Supabase schemas
--    (mcp_reader only has USAGE on 'public', so these are already blocked,
--    but explicit revokes make a security audit easier to read)
REVOKE ALL ON SCHEMA auth    FROM mcp_reader;
REVOKE ALL ON SCHEMA storage FROM mcp_reader;
REVOKE ALL ON SCHEMA realtime FROM mcp_reader;

-- ============================================================================
-- After running this migration, create the connection string:
--
--   postgresql://mcp_reader:YOUR_PASSWORD@db.<ref>.supabase.co:5432/postgres
--
-- Add to voice-server/.env:
--   MCP_DB_URL=postgresql://mcp_reader:YOUR_PASSWORD@db.<ref>.supabase.co:5432/postgres
--   POSTGRES_ALLOWED_TABLES=posts,profiles,scheduled_content
-- ============================================================================
