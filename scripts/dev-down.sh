#!/bin/bash

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(dirname "$SCRIPT_DIR")"

GREEN='\033[0;32m'
NC='\033[0m'

log_info() {
  echo -e "${GREEN}[$(date '+%H:%M:%S')]${NC} $1"
}

log_info "Stopping services..."

if [ -f "$ROOT_DIR/.pids/voice-server.pid" ]; then
  PID=$(cat "$ROOT_DIR/.pids/voice-server.pid")
  if kill -0 $PID 2>/dev/null; then
    kill $PID
    log_info "Stopped voice-server"
  fi
  rm "$ROOT_DIR/.pids/voice-server.pid"
fi

if [ -f "$ROOT_DIR/.pids/webhook-server.pid" ]; then
  PID=$(cat "$ROOT_DIR/.pids/webhook-server.pid")
  if kill -0 $PID 2>/dev/null; then
    kill $PID
    log_info "Stopped webhook-server"
  fi
  rm "$ROOT_DIR/.pids/webhook-server.pid"
fi

lsof -ti :3001 | xargs kill -9 2>/dev/null || true
lsof -ti :3000 | xargs kill -9 2>/dev/null || true

if command -v docker &> /dev/null; then
  cd "$ROOT_DIR/n8n-local"
  docker-compose down 2>/dev/null || true
  log_info "Stopped Docker containers"
fi

log_info "Stack stopped"
