# n8n Workflows

Crystal Clear Voices / DiscoAgents n8n automation workflows.

## Workflows

### 1. Client Intake — Onboarding Pipeline (`client-intake-onboarding.json`)

Receives client intake form submissions, normalises and tags the data, creates a Notion Client record,
appends pain/outcome as page body blocks, and fires a Discord alert.

**Trigger:** `POST /webhook/client-intake`

**Env required:**

- `NOTION_CLIENTS_DB_ID` — Clients database ID
- `DISCORD_INTAKE_WEBHOOK_URL` — Discord channel webhook

**Flow:** Intake Webhook → Normalize+Tag (Code) → [Notion create record + Discord alert] → Append body blocks → Respond 200

---

### 2. Notion — Client → Blueprint (Living Infra Spec) (`notion-client-blueprint-draft.json`)

Watches the Clients DB for new pages. Calls Claude to generate the full 6-section infra spec from intake
data, then creates a structured Blueprint page in Notion via raw API calls. Sections are appended
sequentially so block order is guaranteed.

**Trigger:** Notion — page added to Clients DB

**Env required:**

- `NOTION_CLIENTS_DB_ID` — Clients DB ID
- `NOTION_BLUEPRINTS_DB_ID` — Blueprints DB ID
- `ANTHROPIC_API_KEY` — Claude API key
- `CLAUDE_MODEL` — e.g. `claude-sonnet-4-6`
- `NOTION_TOKEN` — Notion integration bearer token
- `DISCORD_INTAKE_WEBHOOK_URL` — reused for blueprint alert

**Notion setup required before activating:**

1. Blueprints DB columns: `Status` (select: Draft/Reviewed/In Progress/Live), `Primary Focus`
   (multi_select), `Stack Maturity` (select: Ad-hoc/Emerging/Structured), `Security Level`
   (select: Informal/Basic Controls/Formal (SOC2/ISO/GDPR)), `Client` (relation → Clients DB),
   `Created From Intake` (checkbox)
2. Clients DB: add `Blueprint` (relation → Blueprints DB), ensure `Status` has `"Blueprint drafted"` option
3. Property names in `Extract Client Fields` Code node must match your actual Clients DB column names
   exactly (check especially the title property — may be `Name` or `Company`)

**Blueprint page sections generated:**

- Section 1: Current State (company profile, systems in play, pain bullets with categories, security posture)
- Section 2: Target Outcomes (30-day, 90-day, constraints/non-negotiables)
- Section 3: Recommended Infra Stack (cloud choice + rationale, environments, core services table)
- Section 4: Priority Automations v1 (3 automations: trigger, systems, MCP tools, security notes, effort)
- Section 5: Access & Security Requirements (access checklist, security level recap, MCP safety notes)
- Section 6: 30-Day Implementation Plan (week-by-week todo checklist)

**Flow:** Notion trigger → Extract fields → Build Claude prompt → Claude API → Parse + build block arrays
→ Create Blueprint page → [Append S1+2 → S3 → S4 → S5+6 → Discord alert] + [Update Client status + relation (parallel)]

---

### 3. Notion — Creator → Content Pipeline Blueprint (`creator-content-pipeline-blueprint.json`)

Same AI-driven pattern as the infra spec, retuned for creator brands (TheDiscoBass, TheSteeleZone,
creator clients). Generates a 6-section content systems spec focused on platform strategy, content
pipelines, repurposing, brand voice, and launch plan.

**Trigger:** Notion — page added to Creators DB

**Env required:**

- `NOTION_CREATORS_DB_ID` — Creator records DB
- `NOTION_BLUEPRINTS_DB_ID` — shared Blueprints DB (add `Blueprint Type` select: Infra Spec / Content Pipeline)
- `ANTHROPIC_API_KEY`, `CLAUDE_MODEL`, `NOTION_TOKEN`, `DISCORD_INTAKE_WEBHOOK_URL`

**Creator intake schema:** `crew-service/configs/creator-intake-schema.json` — 6 sections covering
brand/contact, platforms & formats, tools, monetization, bottlenecks, and brand voice/safety.

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
- Agent guardrails enforced: `SOCIAL_ALLOWED_PLATFORMS` allow-list, `SOCIAL_MAX_POST_LENGTH`, no autonomous
  publish to restricted platforms, no brand deal content approval without human review
- Platform strategy drives priorities rather than cloud/compliance

**Flow:** Notion trigger → Extract fields → Build Claude prompt → Claude API → Parse + build block arrays
→ Create Blueprint page → [Append S1+2 → S3 → S4 → S5+6 → Discord alert] + [Update Creator status + relation (parallel)]

---

### 4. Social Media Agent (`social-media-agent.json`)

Cross-platform content scheduler and publisher via Meta Graph API (Facebook/Instagram) and TikTok API.

**Nodes:**

- **Webhook**: Receives publish requests from the API server or n8n schedule triggers
- **Validation**: Enforces platform-specific content length and format constraints
- **Database**: Persists post record to PostgreSQL with `draft` status
- **Scheduler**: Routes to immediate publish or deferred queue based on `scheduled_time`
- **Platform Publisher**: Calls Meta Graph API or TikTok API with platform-specific payload
- **Status Update**: Writes final `published` / `failed` status and timestamp to DB

**Inputs:**

```json
{
  "platform": "facebook|instagram|tiktok",
  "content": "Post content text",
  "scheduled_time": "2026-01-01T14:30:00Z"
}
```

**Env required:**

- `META_PAGE_ID`, `META_PAGE_ACCESS_TOKEN`, `META_IG_USER_ID`
- `TIKTOK_ACCESS_TOKEN`, `TIKTOK_OPEN_ID`

---

### 5. Concierge Agent (`concierge-agent.json`)

Sophie AI voice concierge request processor — ingests structured intent from Twilio voice calls and
routes to fulfilment paths.

**Nodes:**

- **Webhook**: Receives intent payload forwarded from voice-server `/twilio/gather`
- **Parser**: Normalises caller intent and extracts entities
- **Database**: Creates `concierge_requests` record in Supabase / RDS Aurora
- **Router**: Branches on `request_type` (booking / information / escalation)
- **Claude Processor**: Resolves information and booking requests via Anthropic API (`claude-sonnet-4-6`)
- **Notification**: Returns TwiML `<Say>` response or sends follow-up SMS via Twilio
- **Status Update**: Writes resolution status back to DB

**Request Types:**

- `booking`: Reservation and scheduling requests
- `information`: General enquiries resolved by Claude
- `escalation`: Routes to human handoff when confidence threshold is not met

**Inputs:**

```json
{
  "user_id": "user_12345",
  "request_type": "booking|information|escalation",
  "description": "Caller intent transcribed by Twilio",
  "priority": "normal|high"
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

**Env required:**

- `ANTHROPIC_API_KEY`, `CLAUDE_MODEL`
- `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`
- `SUPABASE_URL`, `SUPABASE_SERVICE_KEY` (or `DATABASE_URL` for RDS Aurora)

---

## Importing Workflows

1. Open n8n dashboard
2. Go to **Workflows** → **Import**
3. Upload the JSON file
4. Configure credentials:
   - **Database**: Supabase / RDS Aurora PostgreSQL connection
   - **Meta**: `META_PAGE_ACCESS_TOKEN`, `META_PAGE_ID`, `META_IG_USER_ID`
   - **TikTok**: `TIKTOK_ACCESS_TOKEN`, `TIKTOK_OPEN_ID`
   - **AI**: `ANTHROPIC_API_KEY` — Claude is the LLM backend for all AI processing

---

## Environment Variables Required

```bash
# Social media agent
META_PAGE_ID=
META_PAGE_ACCESS_TOKEN=
META_IG_USER_ID=
TIKTOK_ACCESS_TOKEN=
TIKTOK_OPEN_ID=

# Concierge agent
ANTHROPIC_API_KEY=
CLAUDE_MODEL=claude-sonnet-4-6
TWILIO_ACCOUNT_SID=
TWILIO_AUTH_TOKEN=

# Database (both agents)
SUPABASE_URL=
SUPABASE_SERVICE_KEY=

# Notion workflows
NOTION_TOKEN=
NOTION_CLIENTS_DB_ID=
NOTION_BLUEPRINTS_DB_ID=
NOTION_CREATORS_DB_ID=
DISCORD_INTAKE_WEBHOOK_URL=
```

---

## Database Schema

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
    "platform": "instagram",
    "content": "Testing Crystal Clear Voices social media agent!"
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

## Monitoring & Logs

- View execution history in n8n dashboard → Workflows → Executions
- Query `concierge_requests` and `social_media_posts` for audit trails
- Monitor webhook endpoint availability at `GET /health` on the voice-server
- Configure n8n error workflows or Slack/Discord alerts for failed executions
