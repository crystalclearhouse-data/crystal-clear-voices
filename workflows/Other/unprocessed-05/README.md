# Webhook Dead Letter Handler

- **Purpose:** Catches failed n8n webhook executions, logs them to Postgres `webhook_errors` table, and sends a Discord alert for manual review.
- **Category:** Infrastructure
- **Status:** Unprocessed
- **Owner:** @the_steele_zone

## Inputs
- n8n Error Workflow trigger — any workflow that sets this as its error workflow

## Outputs
- Postgres `webhook_errors` row (workflow_id, error_message, payload, failed_at)
- Discord alert via `DISCORD_INTAKE_WEBHOOK_URL`

## Dependencies
- `DATABASE_URL` (Postgres), `DISCORD_INTAKE_WEBHOOK_URL`

## How to Run / Test
1. Create workflow with intentional error.
2. Set this as its Error Workflow in n8n settings.
3. Trigger error — verify DB row and Discord message.

## Monitoring & Alerts
- Self-monitoring: if this workflow fails, check n8n execution log directly.

## Change Log
- 2026-03-07 — Named and documented
