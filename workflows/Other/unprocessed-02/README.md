# Creator Content Pipeline

- **Purpose:** Automates the content production loop for @the-steele-zone: Claude drafts copy, sends for human approval in Discord, then cross-posts on approval.
- **Category:** Other → promote to Content Creation
- **Status:** Unprocessed
- **Owner:** @the_steele_zone
- **n8n Source:** `n8n-workflows/creator-content-pipeline-blueprint.json`

## Inputs
- Manual trigger or schedule: content brief (topic, platform, category)

## Outputs
- Discord approval gate → approved posts published via `social_post_all` MCP tool / n8n social-media-agent

## Dependencies
- `ANTHROPIC_API_KEY`, `DISCORD_INTAKE_WEBHOOK_URL`
- `META_PAGE_ACCESS_TOKEN`, `TIKTOK_ACCESS_TOKEN`

## How to Run / Test
1. Import `n8n-workflows/creator-content-pipeline-blueprint.json`.
2. Trigger manually with brief: `{"topic":"DJ event recap","platform":"instagram","category":"music"}`.
3. Approve in Discord — verify post appears on Instagram.

## Monitoring & Alerts
- Discord approval thread per run; n8n error hook on failure.

## Change Log
- 2026-03-07 — Named and documented
