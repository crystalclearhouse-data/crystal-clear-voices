# Concierge Agent v2 (n8n-native)

- **Purpose:** n8n-native version of the concierge agent. Receives requests from api-server, enriches with Claude, and routes to the correct fulfillment path (booking, info, support).
- **Category:** Agent Experiments
- **Status:** Unprocessed
- **Owner:** @the_steele_zone
- **n8n Source:** `n8n-workflows/concierge-agent.json`

## Inputs
- Webhook `POST /webhook/concierge-webhook` — concierge request object

## Outputs
- Postgres `concierge_responses` row; optional Twilio/Discord notification

## Dependencies
- `ANTHROPIC_API_KEY`, `DATABASE_URL`, `TWILIO_ACCOUNT_SID`

## How to Run / Test
1. Import `n8n-workflows/concierge-agent.json`.
2. `curl -X POST <concierge-webhook> -d '{"user_id":"test","request_type":"information","description":"What are your hours?","priority":"normal"}'`

## Monitoring & Alerts
- n8n execution log; Discord alert on failure.

## Change Log
- 2026-03-07 — Named and documented
