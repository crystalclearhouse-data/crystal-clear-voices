# n8n Workflows

Crystal Clear Voices / DiscoAgents n8n workflows.

## Workflows

### 1. Client Intake — Onboarding Pipeline (`client-intake-onboarding.json`)

Receives client intake form submissions, normalises and tags the data, creates a Notion Client record, appends pain/outcome as page body blocks, and fires a Discord alert.

**Trigger:** `POST /webhook/client-intake`

**Env required:**
- `NOTION_CLIENTS_DB_ID` — Clients database ID
- `DISCORD_INTAKE_WEBHOOK_URL` — Discord channel webhook

**Flow:** Intake Webhook → Normalize+Tag (Code) → [Notion create record + Discord alert] → Append body blocks → Respond 200

---

### 2. Notion — Client → Blueprint (Living Infra Spec) (`notion-client-blueprint-draft.json`)

Watches the Clients DB for new pages. Calls Claude to generate the full 6-section infra spec from intake data, then creates a structured Blueprint page in Notion via raw API calls. Sections are appended sequentially so block order is guaranteed.

**Trigger:** Notion — page added to Clients DB

**Env required:**
- `NOTION_CLIENTS_DB_ID` — Clients DB ID
- `NOTION_BLUEPRINTS_DB_ID` — Blueprints DB ID
- `ANTHROPIC_API_KEY` — Claude API key
- `CLAUDE_MODEL` — e.g. `claude-sonnet-4-6`
- `NOTION_TOKEN` — Notion integration bearer token
- `DISCORD_INTAKE_WEBHOOK_URL` — reused for blueprint alert

**Notion setup required before activating:**
1. Blueprints DB columns: `Status` (select: Draft/Reviewed/In Progress/Live), `Primary Focus` (multi_select), `Stack Maturity` (select: Ad-hoc/Emerging/Structured), `Security Level` (select: Informal/Basic Controls/Formal (SOC2/ISO/GDPR)), `Client` (relation → Clients DB), `Created From Intake` (checkbox)
2. Clients DB: add `Blueprint` (relation → Blueprints DB), ensure `Status` has `"Blueprint drafted"` option
3. Property names in `Extract Client Fields` Code node must match your actual Clients DB column names exactly (check especially the title property — may be `Name` or `Company`)

**Blueprint page sections generated:**
- Section 1: Current State (company profile, systems in play, pain bullets with categories, security posture)
- Section 2: Target Outcomes (30-day, 90-day, constraints/non-negotiables)
- Section 3: Recommended Infra Stack (cloud choice + rationale, environments, core services table)
- Section 4: Priority Automations v1 (3 automations: trigger, systems, MCP tools, security notes, effort)
- Section 5: Access & Security Requirements (access checklist, security level recap, MCP safety notes)
- Section 6: 30-Day Implementation Plan (week-by-week todo checklist)

**Flow:** Notion trigger → Extract fields → Build Claude prompt → Claude API → Parse + build block arrays → Create Blueprint page → [Append S1+2 → S3 → S4 → S5+6 → Discord alert] + [Update Client status + relation (parallel)]

---

### 3. Notion — Creator → Content Pipeline Blueprint (`creator-content-pipeline-blueprint.json`)

Same AI-driven pattern as the infra spec, retuned for creator brands (TheDiscoBass, TheSteeleZone, creator clients). Generates a 6-section content systems spec focused on platform strategy, content pipelines, repurposing, brand voice, and launch plan.

**Trigger:** Notion — page added to Creators DB

**Env required:**
- `NOTION_CREATORS_DB_ID` — Creator records DB
- `NOTION_BLUEPRINTS_DB_ID` — shared Blueprints DB (add `Blueprint Type` select: Infra Spec / Content Pipeline)
- `ANTHROPIC_API_KEY`, `CLAUDE_MODEL`, `NOTION_TOKEN`, `DISCORD_INTAKE_WEBHOOK_URL`

**Creator intake schema:** `crew-service/configs/creator-intake-schema.json` — 6 sections covering brand/contact, platforms & formats, tools, monetization, bottlenecks, and brand voice/safety.

**Blueprints DB columns to add (creator-specific):**
- `Blueprint Type` (select): Infra Spec, Content Pipeline
- `Platform Maturity` (select): Starting Out, Active, Scaling
- `Brand Safety Level` (select): Open, Brand Deal Safe, Restricted
- `Creator` (relation → Creators DB)

**Blueprint page sections generated:**
- Section 1: Content Snapshot (brand profile, platforms, tools, monetization, bottlenecks with categories, platform health)
- Section 2: Content Goals (30-day, 90-day, constraints + brand deal restrictions)
- Section 3: Content Stack (platform strategy with primary/secondary/experimental, stack by layer: calendar/editing/scheduling/storage/analytics, calendar structure)
- Section 4: Priority Content Pipelines v1 (3 pipelines: trigger, platforms, tools, MCP tools, safety notes, effort)
- Section 5: Brand Voice & Platform Rules (tone, core topics, prohibited, approval workflow, platform-specific rules, hard agent guardrails)
- Section 6: 30-Day Content Pipeline Launch Plan (week-by-week todo checklist)

**Key differences from Infra Spec:**
- Section 5 is Brand Voice & Platform Rules (not Access & Security)
- Agent guardrails enforced: SOCIAL_ALLOWED_PLATFORMS allow-list, SOCIAL_MAX_POST_LENGTH, no autonomous publish to restricted platforms, no brand deal content approval without human
- Platform strategy drives priorities rather than cloud/compliance

**Flow:** Notion trigger → Extract fields → Build Claude prompt → Claude API → Parse + build block arrays → Create Blueprint page → [Append S1+2 → S3 → S4 → S5+6 → Discord alert] + [Update Creator status + relation (parallel)]

---

### 4. Social Media Agent (`social-media-agent.json`)

Handles content creation, scheduling, and posting across social media platforms.

**Nodes:**
- **Webhook**: Receives post requests
- **Validation**: Checks content length and format
- **Database**: Saves posts to PostgreSQL
- **Scheduling**: Checks if post should be scheduled or published immediately
- **API Integration**: Posts to social media platforms
- **Status Update**: Updates post status in database

**Inputs:**
```json
{
  "platform": "twitter|instagram|facebook",
  "content": "Post content text",
  "scheduled_time": "2024-02-26T14:30:00Z (optional)"
}
```

---

### 5. Concierge Agent (`concierge-agent.json`)

Handles user service requests including bookings, information requests, and support tickets.

**Nodes:**
- **Webhook**: Receives user requests
- **Parser**: Extracts request details
- **Database**: Creates request record
- **Router**: Routes based on request type
- **Processors**: Handles booking, information, or support requests
- **Notification**: Sends confirmation to user
- **Status Update**: Updates request status

**Request Types:**
- `booking`: Hotel, restaurant, event reservations
- `information`: General enquiries answered by AI
- `support`: Support tickets requiring human assistance

**Inputs:**
```json
{
  "user_id": "user_12345",
  "request_type": "booking|information|support",
  "description": "What does the user need?",
  "priority": "normal|high (optional)"
}
```

**Outputs:**
```json
{
  "success": true,
  "request_id": 456,
  "status": "processing",
  "user_id": "user_12345"
}
```

---

## Importing Workflows

1. Open n8n dashboard
2. Go to **Workflows** → **Import**
3. Upload the JSON file
4. Configure credentials:
   - **Database**: PostgreSQL connection
   - **API Keys**: Social media platform tokens
   - **Email**: SMTP configuration for notifications
   - **AI**: OpenAI API key (for concierge information requests)

---

## Environment Variables Required

```bash
# For social media agent
SOCIAL_MEDIA_API_KEY=your_api_key
SOCIAL_MEDIA_SECRET=your_secret

# For concierge agent  
BOOKING_API_KEY=your_booking_api_key
OPENAI_API_KEY=your_openai_key
SMTP_PASSWORD=your_email_password
```

---

## Database Schema

The workflows expect these tables:

```sql
-- Social Media Posts
CREATE TABLE social_media_posts (
  id SERIAL PRIMARY KEY,
  platform TEXT NOT NULL,
  content TEXT NOT NULL,
  posted_at TIMESTAMP DEFAULT NOW(),
  status TEXT DEFAULT 'draft'
);

-- Concierge Requests
CREATE TABLE concierge_requests (
  id SERIAL PRIMARY KEY,
  user_id TEXT NOT NULL,
  request_type TEXT NOT NULL,
  description TEXT,
  status TEXT DEFAULT 'pending',
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Concierge Responses
CREATE TABLE concierge_responses (
  id SERIAL PRIMARY KEY,
  request_id INT REFERENCES concierge_requests(id),
  response TEXT,
  action_taken TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);
```

---

## Testing Workflows

### Test Social Media Agent
```bash
curl -X POST http://localhost:5678/webhook/social-media-webhook \
  -H "Content-Type: application/json" \
  -d '{
    "platform": "twitter",
    "content": "Testing Crystal Clear Voices social media agent!",
    "scheduled_time": null
  }'
```

### Test Concierge Agent
```bash
curl -X POST http://localhost:5678/webhook/concierge-webhook \
  -H "Content-Type: application/json" \
  -d '{
    "user_id": "test_user_123",
    "request_type": "information",
    "description": "What are your operating hours?",
    "priority": "normal"
  }'
```

---

## Workflow Execution Order

Both workflows use `v1` execution order (sequential node processing). Adjust in workflow settings if parallel execution is needed.

---

## Monitoring & Logs

- View execution logs in n8n dashboard
- Check database for request/post history
- Monitor webhook endpoints for failures
- Set up Slack/email alerts for error handling
