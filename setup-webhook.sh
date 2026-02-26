#!/bin/bash

mkdir -p webhook-server/.vscode scripts

cat > webhook-server/package.json << 'PKG'
{
  "name": "crystal-clear-voices-webhook-server",
  "version": "1.0.0",
  "type": "module",
  "main": "webhook-server.js",
  "scripts": {
    "start": "node webhook-server.js"
  },
  "dependencies": {
    "express": "^4.18.2",
    "dotenv": "^16.3.1"
  }
}
PKG

cat > webhook-server/.env << 'ENV'
WEBHOOK_PORT=3000
NODE_ENV=development
ANTHROPIC_API_KEY=sk_ca2a9f6eaf079f7f45edfe7844b0b18abe8f86d17cc4308b
N8N_INSTANCE_URL=https://ggggggggggggggg.app.n8n.cloud
ENV

chmod +x setup-webhook.sh

echo "✅ Setup complete!"
