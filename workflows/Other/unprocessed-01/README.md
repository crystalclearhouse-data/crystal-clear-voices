# Client Intake Onboarding

- **Purpose:** Receives DiscoAgents client intake form submissions, creates a Notion client record, and posts a Discord alert.
- **Category:** Other → promote to Production
- **Status:** Unprocessed
- **Owner:** @the_steele_zone
- **n8n Source:** `n8n-workflows/client-intake-onboarding.json`

## Inputs
- Webhook `POST /webhook/client-intake` — JSON matching `crew-service/configs/client-intake-schema.json`

## Outputs
- Notion (`NOTION_CLIENTS_DB_ID`) — new client record
- Discord (`DISCORD_INTAKE_WEBHOOK_URL`) — alert with client name and primary pain point

## Dependencies
- `NOTION_TOKEN`, `NOTION_CLIENTS_DB_ID`
- `DISCORD_INTAKE_WEBHOOK_URL`
- `ANTHROPIC_API_KEY` (optional — Claude summary generation)

## How to Run / Test
1. Import `n8n-workflows/client-intake-onboarding.json` in n8n.
2. Configure Notion + Discord credentials.
3. `curl -X POST <webhook-url> -H "Content-Type: application/json" -d '{"company_name":"Test Co","contact_name":"Jane","contact_email":"jane@test.co","website":"https://test.co","team_size":"1-5","pain_point_primary":"Lead intake and routing","pain_description":"Manual","outcome_30_days":"Automated"}'`

## Monitoring & Alerts
- n8n execution log; Discord error workflow on failure.

## Change Log
- 2026-03-07 — Named and documented
