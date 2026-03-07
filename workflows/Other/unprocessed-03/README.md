# Notion Client Blueprint Draft

- **Purpose:** When a new client record lands in Notion `NOTION_CLIENTS_DB_ID`, auto-generates a scoped automation blueprint page in `NOTION_BLUEPRINTS_DB_ID` using Claude.
- **Category:** Other → promote to Production
- **Status:** Unprocessed
- **Owner:** @the_steele_zone
- **n8n Source:** `n8n-workflows/notion-client-blueprint-draft.json`

## Inputs
- Notion trigger: new page in `NOTION_CLIENTS_DB_ID`

## Outputs
- New Blueprint page in `NOTION_BLUEPRINTS_DB_ID` with Claude-generated scope

## Dependencies
- `NOTION_TOKEN`, `NOTION_CLIENTS_DB_ID`, `NOTION_BLUEPRINTS_DB_ID`
- `ANTHROPIC_API_KEY`

## How to Run / Test
1. Import `n8n-workflows/notion-client-blueprint-draft.json`.
2. Create a test client page in Notion — verify Blueprint draft appears.

## Monitoring & Alerts
- n8n execution log.

## Change Log
- 2026-03-07 — Named and documented
