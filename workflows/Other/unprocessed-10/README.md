# Discord Alert Router

- **Purpose:** Central alert router — receives structured alert payloads and fans out to the correct Discord channel based on `alert_type` (deploy, error, order, intake).
- **Category:** Infrastructure
- **Status:** Unprocessed
- **Owner:** @the_steele_zone

## Inputs
- Webhook `POST /webhook/discord-alert` — `{alert_type, title, message, severity}`

## Outputs
- Discord message to mapped channel webhook

## Dependencies
- `DISCORD_INTAKE_WEBHOOK_URL` and per-channel webhook URLs (stored as n8n credentials)

## How to Run / Test
1. Build Webhook → Switch (alert_type) → Discord Send Message nodes.
2. `curl -X POST <webhook-url> -d '{"alert_type":"error","title":"Test","message":"Hello","severity":"high"}'`

## Monitoring & Alerts
- If this workflow fails, fallback to n8n's built-in error email.

## Change Log
- 2026-03-07 — Named and documented
