# TikTok Analytics Ingestion

- **Purpose:** Daily pull of @the-steele-zone TikTok video stats (views, likes, shares, comments) into Postgres `tiktok_analytics` for the Sophie Daily TikTok Report workflow.
- **Category:** Infrastructure
- **Status:** Unprocessed
- **Owner:** @the_steele_zone

## Inputs
- Schedule: daily 02:00 UTC

## Outputs
- Postgres `tiktok_analytics` upsert (video_id, stats, snapshot_date)

## Dependencies
- `TIKTOK_ACCESS_TOKEN`, `TIKTOK_OPEN_ID`, `DATABASE_URL`

## How to Run / Test
1. Build Schedule Trigger → TikTok `tiktok_get_videos` node → Postgres Upsert.
2. Test manual run — verify rows in `tiktok_analytics`.

## Monitoring & Alerts
- Discord alert if row count = 0 (likely token expiry).

## Change Log
- 2026-03-07 — Named and documented
