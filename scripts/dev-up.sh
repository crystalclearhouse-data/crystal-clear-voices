#!/bin/bash

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(dirname "$SCRIPT_DIR")"

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

log_info() {
  echo -e "${GREEN}[$(date '+%H:%M:%S')]${NC} $1"
}

log_warn() {
  echo -e "${YELLOW}[$(date '+%H:%M:%S')]${NC} $1"
}

log_error() {
  echo -e "${RED}[$(date '+%H:%M:%S')]${NC} $1"
}

check_env_file() {
  local service=$1
  local env_file="$ROOT_DIR/$service/.env"

  if [ ! -f "$env_file" ]; then
    log_error "Missing $env_file"
    log_info "Copy from .env.example: cp $ROOT_DIR/$service/.env.example $env_file"
    return 1
  fi
  return 0
}

health_check() {
  local url=$1
  local service=$2
  local elapsed=0

  log_info "Checking $service at $url..."

  while [ $elapsed -lt 30 ]; do
    if curl -s "$url" > /dev/null 2>&1; then
      log_info "✓ $service is healthy"
      return 0
    fi
    elapsed=$((elapsed + 1))
    sleep 1
  done

  log_warn "✗ $service did not respond within 30s (may still be starting)"
  return 1
}

log_info "=== CrystalClearHouse Local Stack ==="
log_info "Root: $ROOT_DIR"
log_info ""

if ! command -v node &> /dev/null; then
  log_error "Node.js not found"
  exit 1
fi
log_info "Node.js: $(node --version)"

log_info ""
log_info "Checking .env files..."
check_env_file "voice-server" || exit 1
check_env_file "webhook-server" || exit 1

log_info ""
log_info "Checking MCP env vars..."
MCP_MISSING=()
for mcp_var in \
  ELEVENLABS_API_KEY PERPLEXITY_API_KEY \
  OUTLOOK_CLIENT_ID \
  META_PAGE_ID META_PAGE_ACCESS_TOKEN META_IG_USER_ID \
  TIKTOK_ACCESS_TOKEN \
  DISCORD_BOT_TOKEN \
  NOTION_TOKEN \
  SUPABASE_DB_URL \
  TWILIO_ACCOUNT_SID TWILIO_API_KEY TWILIO_API_SECRET; do
  [ -z "${!mcp_var}" ] && MCP_MISSING+=("$mcp_var")
done
if [ ${#MCP_MISSING[@]} -gt 0 ]; then
  log_warn "MCP env vars not set — some MCP servers will fail until configured:"
  for v in "${MCP_MISSING[@]}"; do log_warn "  missing: $v"; done
  log_warn "  Export them in ~/.zshrc or a .envrc at the project root"
else
  log_info "✓ MCP env vars OK"
fi

log_info ""
log_info "=== Starting Services ==="
log_info ""

# Start voice-server
log_info "Starting voice-server (port 3001)..."
cd "$ROOT_DIR/voice-server"

lsof -ti :3001 | xargs kill -9 2>/dev/null || true
sleep 1

npm start > "$ROOT_DIR/.logs/voice-server.log" 2>&1 &
VOICE_PID=$!
echo $VOICE_PID > "$ROOT_DIR/.pids/voice-server.pid"
log_info "voice-server PID: $VOICE_PID"

health_check "http://localhost:3001/health" "voice-server"

# Start webhook-server
log_info "Starting webhook-server (port 3000)..."
cd "$ROOT_DIR/webhook-server"

lsof -ti :3000 | xargs kill -9 2>/dev/null || true
sleep 1

npm start > "$ROOT_DIR/.logs/webhook-server.log" 2>&1 &
WEBHOOK_PID=$!
echo $WEBHOOK_PID > "$ROOT_DIR/.pids/webhook-server.pid"
log_info "webhook-server PID: $WEBHOOK_PID"

health_check "http://localhost:3000/webhook/status" "webhook-server"

if command -v docker &> /dev/null; then
  N8N_DIR="$(dirname "$ROOT_DIR")/n8n-local"
  if [ -d "$N8N_DIR" ]; then
    log_info "Starting n8n (Docker, port 5678)..."
    cd "$N8N_DIR"
    docker-compose up -d 2> "$ROOT_DIR/.logs/n8n.log"
    log_info "n8n starting..."
    health_check "http://localhost:5678/api/v1/health" "n8n"
  else
    log_warn "n8n-local not found at $N8N_DIR, skipping n8n"
  fi
else
  log_warn "Docker not available, skipping n8n"
fi

log_info ""
log_info "=== Stack Running ==="
log_info "voice-server   → http://localhost:3001/health"
log_info "webhook-server → http://localhost:3000/webhook/status"
log_info "n8n            → http://localhost:5678"
log_info ""
log_info "Logs: tail -f .logs/voice-server.log"
log_info "Stop: scripts/dev-down.sh"
log_info ""
log_info "MCP servers → 13 configured in .mcp.json (managed by Claude Code)"
log_info "  One-time setup required:"
log_info "    Google Workspace → npx google-workspace-mcp accounts add personal"
log_info "    Outlook          → set OUTLOOK_CLIENT_ID + Device Flow auth on first use"
log_info "    macOS            → grant Automation permission when prompted"
log_info "    ElevenLabs       → set ELEVENLABS_API_KEY"
log_info "    Perplexity       → set PERPLEXITY_API_KEY"
log_info "    n8n              → set N8N_API_TOKEN (already in voice-server/.env)"
log_info "    Postgres/Supabase→ set SUPABASE_DB_URL=postgresql://postgres:pass@db.xxx.supabase.co:5432/postgres"
log_info "    Social Media     → set META_*, TIKTOK_*, DISCORD_BOT_TOKEN"
log_info "    Notion           → set NOTION_TOKEN (from notion.so/my-integrations)"
log_info "    LinkedIn         → auth via browser on first use (no setup needed)"
log_info "    AWS Docs         → no auth needed, runs via uvx"
log_info "    Filesystem       → no auth needed, scoped to project root"
log_info "  Tip: add uv + exports to ~/.zshrc → echo 'export PATH=\"\$HOME/.local/bin:\$PATH\"' >> ~/.zshrc"
log_info ""
