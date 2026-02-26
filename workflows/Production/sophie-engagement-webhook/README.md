# Sophie Engagement Webhook

- Purpose: Ingest engagement events for Sophie and forward to Supabase / analytics.
- Category: Production
- Status: Active
- Owner: @the_steele_zone

## Inputs
- Webhook POST from Sophie app

## Outputs
- Supabase row insert
- Slack notification (optional)

## Dependencies
- Supabase project: CRYSTALCLEAR_DB
- n8n credentials: webhook, supabase

## How to Run / Test
- Deploy to n8n and POST example payload to the workflow webhook URL.

## Change Log
- 2026-02-25 — Created
