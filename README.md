# Crystal Clear Voices

Production AI voice concierge and social media automation platform for The Steele Zone / Crystal Clear House.

**Domain:** `voice.thediscobass.com` | **Brand:** [@the-steele-zone](https://github.com/the-steele-zone)

---

## System Overview

| Service | Port | Description |
| --- | --- | --- |
| `voice-server` | 3001 | Sophie AI voice concierge — Twilio → Perplexity → Claude → ElevenLabs TTS |
| `webhook-server` | 3000 | n8n webhook receiver / API server |
| `crew-service` | 8000 | CrewAI DevOps orchestration (FastAPI) |
| `n8n` | 5678 | Workflow automation — 28 workflows across 5 categories |

**Infrastructure:** AWS RDS Aurora PostgreSQL (production) · Supabase (dev/staging) · Terraform-managed EC2 + API Gateway

---

## Repository Structure

```text
├── voice-server/           # Sophie Express server (Claude + Perplexity + ElevenLabs)
├── api-server/             # REST API for social media + concierge requests
├── crew-service/           # CrewAI FastAPI service + crew configs
├── workflows/              # 28 n8n workflows organised by category
│   ├── Production/         # 3 active production workflows
│   ├── Agent-Experiments/  # 5 AI agent pattern tests
│   ├── Connector-Explorations/ # 5 integration experiments
│   ├── Content-Creation/   # 3 AI content generators
│   ├── Infrastructure/     # 2 system automation workflows
│   ├── Other/              # 10 unprocessed / experimental
│   ├── index.json          # Master workflow index (status, metadata)
│   └── templates/          # README templates
├── n8n-workflows/          # Importable n8n workflow JSON files
├── terraform/              # AWS infrastructure (EC2, RDS Aurora, API Gateway, IAM)
├── tools/workflow-cli/     # Node.js/TypeScript workflow management CLI
├── scripts/                # dev-up.sh / dev-down.sh
├── .agents/authority.md    # Agent permission boundaries
├── .mcp.json               # 14 MCP server configurations
└── .env.example            # Environment variable reference
```

---

## Quick Start (Local Dev)

```bash
# One-time setup for local env files
cp voice-server/.env.example voice-server/.env
cp webhook-server/.env.example webhook-server/.env

# Start all services + MCP preflight check
bash scripts/dev-up.sh

# Quick health check (beginner-friendly)
bash scripts/dev-check.sh

# Stop all services
bash scripts/dev-down.sh
```

Sophie endpoints once running:

```bash
curl http://localhost:3001/health
curl -X POST http://localhost:3001/speak \
  -H "Content-Type: application/json" \
  -d '{"message": "Hello from Sophie"}'
```

---

## Beginner Runbook (MVP)

1. **Set local env files**
  - Copy both `.env.example` files to `.env` in `voice-server` and `webhook-server`.
2. **Start services**
  - Run `bash scripts/dev-up.sh`.
3. **Verify health**
  - Run `bash scripts/dev-check.sh` and confirm no failed checks.
4. **Test HITL workflow**
  - Import `n8n-workflows/mvp-clickup-discord.json` in n8n.
  - Send one approved payload and one rejected payload.
5. **Shut down cleanly**
  - Run `bash scripts/dev-down.sh`.

If anything fails, check logs in `.logs/` first (`voice-server.log`, `webhook-server.log`, `crew-service.log`).

---

## Workflow Management

```bash
# List all workflows and status
npm --prefix tools/workflow-cli install
npm --prefix tools/workflow-cli run start -- list

# Show a specific workflow
npm --prefix tools/workflow-cli run start -- show sophie-engagement-webhook

# Launch web dashboard
npx http-server .
# Open http://localhost:8080/dashboard/index.html
```

---

## Workflow Status

| Status | Count | Description |
| --- | --- | --- |
| Active | 5 | Production-ready, live workflows |
| Testing | 13 | Under validation |
| Unprocessed | 10 | New or not yet evaluated |

Lifecycle: `Unprocessed → Testing → Active` — see [GRADUATION_CRITERIA.md](GRADUATION_CRITERIA.md).

---

## Production Workflows

- **Sophie Engagement Webhook** — inbound engagement triage and response routing
- **Sophie Daily TikTok Report** — scheduled performance analytics digest
- **TheSteezeZone Email Signup** — subscriber onboarding automation

---

## MCP Servers (14 configured)

| Server | Purpose |
| --- | --- |
| `elevenlabs` | TTS voice synthesis |
| `perplexity` | Real-time web search for Sophie |
| `n8n` | Workflow management via MCP |
| `postgres` | Read-only DB access (restricted `mcp_reader` role) |
| `social-media` | Facebook / Instagram / TikTok publishing |
| `twilio` | Voice and SMS management |
| `notion` | Client and Blueprint DB operations |
| `discord` | Alert and notification delivery |
| `linkedin` | LinkedIn content operations |
| `google-workspace` | Calendar, Gmail, Drive |
| `outlook` | Outlook mail and calendar |
| `macos` | macOS system automation |
| `aws-documentation` | AWS docs lookup |
| `filesystem` | Scoped file access (project root only) |

---

## Tech Stack

- **Runtime:** Node.js v25, ESM modules
- **AI:** Claude (`claude-sonnet-4-6`) · Perplexity · ElevenLabs
- **Voice:** Twilio (A2P 10DLC, TwiML)
- **Automation:** n8n (self-hosted Docker + cloud)
- **DB:** AWS RDS Aurora PostgreSQL · Supabase
- **Infra:** Terraform · AWS EC2 · API Gateway
- **Agents:** CrewAI + FastAPI
- **MCP:** 14 servers via `.mcp.json`

---

## Deployment

See [DEPLOYMENT.md](DEPLOYMENT.md) for full AWS deployment instructions.

---

## Owner

[@the-steele-zone](https://github.com/the-steele-zone) — Private repository, internal use only.
