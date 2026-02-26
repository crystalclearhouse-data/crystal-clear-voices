# Workflow CLI (MVP)

No-fluff command-line interface for workflow discovery plus authenticated voice intents.

## Core commands

```bash
# list all workflows
npm --prefix tools/workflow-cli run start -- list

# show metadata + README for one workflow
npm --prefix tools/workflow-cli run start -- show sophie-engagement-webhook

# search by keyword through id/name/category/status
npm --prefix tools/workflow-cli run start -- voice "find production"
```

## Authentication

Voice + MCP commands are authenticated.

```bash
# one-time setup (stores SHA-256 hash locally)
npm --prefix tools/workflow-cli run start -- auth login --token YOUR_SECRET_TOKEN

# set runtime token for each shell session
export WORKFLOW_CLI_TOKEN=YOUR_SECRET_TOKEN

# verify auth state
npm --prefix tools/workflow-cli run start -- auth status
```

## Voice command MVP

```bash
# parse + execute intent
npm --prefix tools/workflow-cli run start -- voice "list all workflows"
npm --prefix tools/workflow-cli run start -- voice "show sophie-engagement-webhook"
npm --prefix tools/workflow-cli run start -- voice "search engagement"

# parse only (debug)
npm --prefix tools/workflow-cli run start -- voice "find tiktok" --json
```

## MCP envelope MVP

Builds an MCP-style payload and executes the parsed intent.

```bash
# print envelope + execute
npm --prefix tools/workflow-cli run start -- mcp "find production workflows"

# print envelope only
npm --prefix tools/workflow-cli run start -- mcp "show sophie-engagement-webhook" --dry-run
```

## Strategy (minimal + scalable)

1. **Authenticate first** with token-hash validation.
2. **Convert speech text to intent** (`list`, `show`, `search`).
3. **Emit MCP envelope** for downstream agent/server integrations.
4. **Execute locally** now; swap transport later without changing command UX.
