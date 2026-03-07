# Sophie Order Confirmation SMS

- **Purpose:** After crew-service records a restaurant order (CCH-XXXX), sends an SMS confirmation to the caller via Twilio.
- **Category:** Other → promote to Production
- **Status:** Unprocessed
- **Owner:** @the_steele_zone

## Inputs
- Webhook `POST /webhook/order-confirmed` — `{customer_phone, confirmation_number, order_summary, pickup_time}`

## Outputs
- Twilio SMS to `customer_phone` with confirmation number and pickup time

## Dependencies
- `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_PHONE_NUMBER`

## How to Run / Test
1. Build webhook trigger in n8n.
2. Wire to Twilio Send Message node.
3. Test: call `/crew/record_order`, capture confirmation, fire webhook manually.

## Monitoring & Alerts
- Twilio delivery receipts; n8n error hook.

## Change Log
- 2026-03-07 — Named and documented
