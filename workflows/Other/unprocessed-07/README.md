# Email Drip Campaign

- **Purpose:** After a new TheSteezeZone email signup, delivers a 3-email drip sequence (Day 0 welcome, Day 3 content spotlight, Day 7 CTA) via Mailchimp/SMTP.
- **Category:** Other → promote to Production
- **Status:** Unprocessed
- **Owner:** @the_steele_zone

## Inputs
- Webhook from `thesteezezone-email-signup` workflow — `{email, first_name, source}`

## Outputs
- Email 1 (immediate): welcome message
- Email 2 (Day 3): latest TikTok/Instagram highlight
- Email 3 (Day 7): booking / service CTA

## Dependencies
- SMTP or Mailchimp credentials, `ANTHROPIC_API_KEY` (personalization)

## How to Run / Test
1. Trigger `thesteezezone-email-signup` with test email.
2. Verify each email arrives with correct delay.

## Monitoring & Alerts
- Mailchimp delivery report; n8n execution log.

## Change Log
- 2026-03-07 — Named and documented
