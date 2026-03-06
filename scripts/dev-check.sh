#!/bin/bash

set +e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(dirname "$SCRIPT_DIR")"

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

PASS_COUNT=0
WARN_COUNT=0
FAIL_COUNT=0

log_pass() {
  PASS_COUNT=$((PASS_COUNT + 1))
  echo -e "${GREEN}✓${NC} $1"
}

log_warn() {
  WARN_COUNT=$((WARN_COUNT + 1))
  echo -e "${YELLOW}!${NC} $1"
}

log_fail() {
  FAIL_COUNT=$((FAIL_COUNT + 1))
  echo -e "${RED}✗${NC} $1"
}

check_command() {
  local cmd=$1
  if command -v "$cmd" >/dev/null 2>&1; then
    log_pass "Command available: $cmd"
  else
    log_fail "Missing command: $cmd"
  fi
}

check_endpoint() {
  local url=$1
  local label=$2
  local code
  code=$(curl -s -o /dev/null -w "%{http_code}" "$url")
  if [ "$code" = "200" ]; then
    log_pass "$label healthy ($url)"
  else
    log_warn "$label not healthy yet ($url, HTTP $code)"
  fi
}

echo ""
echo "Crystal Clear House — Dev Check"
echo "Root: $ROOT_DIR"
echo ""

echo "[1/5] Tooling"
check_command node
check_command npm
check_command curl
check_command docker
echo ""

echo "[2/5] Required env files"
if [ -f "$ROOT_DIR/voice-server/.env" ]; then
  log_pass "Found voice-server/.env"
else
  log_fail "Missing voice-server/.env (copy from voice-server/.env.example)"
fi

if [ -f "$ROOT_DIR/webhook-server/.env" ]; then
  log_pass "Found webhook-server/.env"
else
  log_fail "Missing webhook-server/.env (copy from webhook-server/.env.example)"
fi
echo ""

echo "[3/5] Core local endpoints"
check_endpoint "http://localhost:3001/health" "voice-server"
check_endpoint "http://localhost:3000/webhook/status" "webhook-server"
check_endpoint "http://localhost:8000/health" "crew-service"
check_endpoint "http://localhost:5678" "n8n"
echo ""

echo "[4/5] Workflow files"
if [ -f "$ROOT_DIR/n8n-workflows/mvp-clickup-discord.json" ]; then
  log_pass "Found n8n-workflows/mvp-clickup-discord.json"
else
  log_warn "Missing n8n-workflows/mvp-clickup-discord.json"
fi
echo ""

echo "[5/5] Summary"
echo "Passed:  $PASS_COUNT"
echo "Warnings:$WARN_COUNT"
echo "Failed:  $FAIL_COUNT"
echo ""

if [ "$FAIL_COUNT" -gt 0 ]; then
  echo -e "${RED}Next step:${NC} fix failed checks first, then run: bash scripts/dev-up.sh"
  exit 1
fi

echo -e "${GREEN}Environment looks usable.${NC}"
echo "If services are down, run: bash scripts/dev-up.sh"
exit 0
