# Resume Guide (Future You)

Use these prompts when you come back later.

## What exists

- Main repo: `crystalclearhouse-data`
- Helper stack: `../n8n-local` (not a git repo; local Docker helper only)

## Best Resume Prompt (main project)

```text
Resume crystalclearhouse-data from main: check git status, run bash scripts/dev-check.sh, start services if needed, and summarize next best 3 MVP actions.
```

## Quick Commands (main project)

```bash
cd /Users/data-house/projects/crystalclearhouse-data

# Check state
git status
bash scripts/dev-check.sh

# Start/stop local stack
bash scripts/dev-up.sh
bash scripts/dev-down.sh
```

## Quick Commands (n8n helper)

```bash
cd /Users/data-house/projects/n8n-local

# Start/stop n8n helper stack
docker-compose up -d
docker-compose down

# Optional logs
docker-compose logs -f
```

## Current MVP Workflow File

- `n8n-workflows/mvp-clickup-discord.json`

This includes:
- payload validation
- human approval gate (`human_approved`)
- approved/rejected/invalid responses
- plain-English sticky notes for beginner operation

## Good “continue work” prompts

```text
Open crystalclearhouse-data and continue from RESUME.md.
```

```text
Start local services, run dev-check, and tell me only blockers.
```

```text
Load the HITL ClickUp→Discord workflow context and continue MVP hardening.
```
