# n8n Workflows

Crystal Clear Voices uses two main n8n workflows to power the agent system.

## Workflows

### 1. Social Media Agent (`social-media-agent.json`)

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

**Outputs:**
```json
{
  "success": true,
  "id": 123,
  "platform": "twitter",
  "status": "published"
}
```

---

### 2. Concierge Agent (`concierge-agent.json`)

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
