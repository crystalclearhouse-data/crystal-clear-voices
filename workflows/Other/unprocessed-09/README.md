# Social Media Scheduler

- **Purpose:** Pulls approved draft posts from Postgres `social_media_posts` (status=scheduled) and publishes them at their `posted_at` time via the social-media-agent workflow.
- **Category:** Content Creation
- **Status:** Unprocessed
- **Owner:** @the_steele_zone

## Inputs
- Schedule: every 15 minutes
- Postgres query: `SELECT * FROM social_media_posts WHERE status = 'scheduled' AND posted_at <= NOW()`

## Outputs
- Published posts to Facebook/Instagram/TikTok; status updated to `published`

## Dependencies
- `DATABASE_URL`, `META_PAGE_ACCESS_TOKEN`, `TIKTOK_ACCESS_TOKEN`, `N8N_WEBHOOK_URL`

## How to Run / Test
1. Insert a test row: `INSERT INTO social_media_posts (platform, content, hashtags, posted_at, status) VALUES ('instagram', 'Test post', '{}', NOW(), 'scheduled')`
2. Trigger manual run — verify status flips to `published`.

## Monitoring & Alerts
- n8n execution log; alert if >0 rows stuck in `scheduled` after 1 hour.

## Change Log
- 2026-03-07 — Named and documented
