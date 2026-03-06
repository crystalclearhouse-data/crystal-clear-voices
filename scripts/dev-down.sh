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
  N8N_DIR="$(dirname "$ROOT_DIR")/n8n-local"
  if [ -d "$N8N_DIR" ]; then
    cd "$N8N_DIR"
    docker-compose down 2>/dev/null || true
    log_info "Stopped Docker containers"
  else
    log_info "n8n-local not found, skipping Docker shutdown"
  fi
fi

log_info "Stack stopped"
