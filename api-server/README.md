# API Server Documentation

The Crystal Clear Voices API server provides RESTful endpoints for managing social media posts and concierge requests.

## Quick Start

```bash
cd api-server
npm install
cp .env.example .env
# Edit .env with your database credentials
npm start
```

---

## Configuration (.env)

```bash
# Database
DB_HOST=your-rds-endpoint
DB_PORT=5432
DB_NAME=crystalcleardb
DB_USER=postgres
DB_PASSWORD=your_secure_password

# Server
PORT=3000
NODE_ENV=production

# n8n Integration
N8N_WEBHOOK_URL=http://n8n:5678
```

---

## Endpoints

### Health Check

```http
GET /health
```

**Response (200):**
```json
{
  "status": "healthy",
  "service": "Crystal Clear Voices API",
  "timestamp": "2024-02-26T10:30:00Z"
}
```

---

## Social Media Agent

### Create Post

```http
POST /api/social-media/post
Content-Type: application/json

{
  "platform": "twitter",
  "content": "Your tweet content here",
  "hashtags": ["crystal", "voices"],
  "media_urls": ["https://example.com/image.jpg"],
  "scheduled_time": "2024-02-26T14:30:00Z"
}
```

**Required Fields:**
- `platform`: `twitter`, `instagram`, `facebook`, or `linkedin`
- `content`: 1-5000 characters

**Optional Fields:**
- `hashtags`: Array of hashtag strings
- `media_urls`: Array of image/video URLs
- `scheduled_time`: ISO 8601 datetime for scheduling

**Response (201):**
```json
{
  "success": true,
  "data": {
    "id": 1,
    "platform": "twitter",
    "content": "Your tweet content here",
    "status": "draft"
  }
}
```

---

### Get All Posts

```http
GET /api/social-media/posts?platform=twitter&status=published
```

**Query Parameters:**
- `platform` (optional): Filter by platform
- `status` (optional): `draft`, `scheduled`, `published`, or `failed`

**Response (200):**
```json
{
  "success": true,
  "count": 10,
  "data": [
    {
      "id": 1,
      "platform": "twitter",
      "content": "...",
      "status": "published",
      "created_at": "2024-02-26T10:00:00Z"
    }
  ]
}
```

---

### Get Single Post

```http
GET /api/social-media/posts/:id
```

**Response (200):**
```json
{
  "success": true,
  "data": {
    "id": 1,
    "platform": "twitter",
    "content": "...",
    "status": "published",
    "posted_at": "2024-02-26T14:30:00Z"
  }
}
```

---

### Update Post Status

```http
PATCH /api/social-media/posts/:id
Content-Type: application/json

{
  "status": "published"
}
```

**Valid Statuses:**
- `draft`: Initial state
- `scheduled`: Waiting for scheduled time
- `published`: Posted to platform
- `failed`: Post failed

**Response (200):**
```json
{
  "success": true,
  "data": {
    "id": 1,
    "status": "published",
    "updated_at": "2024-02-26T14:30:00Z"
  }
}
```

---

## Concierge Agent

### Create Request

```http
POST /api/concierge/request
Content-Type: application/json

{
  "user_id": "user_12345",
  "request_type": "booking",
  "description": "I'd like to book a dinner reservation for 4 people tomorrow at 7 PM",
  "priority": "normal"
}
```

**Required Fields:**
- `user_id`: Unique user identifier
- `request_type`: `booking`, `information`, or `support`
- `description`: 1-2000 characters

**Optional Fields:**
- `priority`: `normal` (default) or `high`

**Response (202):**
```json
{
  "success": true,
  "data": {
    "id": 1,
    "request_id": "550e8400-e29b-41d4-a716-446655440000",
    "user_id": "user_12345",
    "request_type": "booking",
    "status": "pending"
  }
}
```

---

### Get All Requests

```http
GET /api/concierge/requests?user_id=user_12345&status=completed
```

**Query Parameters:**
- `user_id` (optional): Filter by user
- `status` (optional): `pending`, `processing`, `completed`, or `failed`
- `request_type` (optional): `booking`, `information`, or `support`

**Response (200):**
```json
{
  "success": true,
  "count": 5,
  "data": [
    {
      "id": 1,
      "request_id": "550e8400-e29b-41d4-a716-446655440000",
      "user_id": "user_12345",
      "request_type": "booking",
      "description": "...",
      "status": "completed",
      "created_at": "2024-02-26T10:00:00Z"
    }
  ]
}
```

---

### Get Single Request with Responses

```http
GET /api/concierge/requests/:id
```

Can use either numeric ID or UUID.

**Response (200):**
```json
{
  "success": true,
  "data": {
    "request": {
      "id": 1,
      "request_id": "550e8400-e29b-41d4-a716-446655440000",
      "user_id": "user_12345",
      "request_type": "booking",
      "status": "completed"
    },
    "responses": [
      {
        "id": 1,
        "response": "Reservation confirmed at Mario's for 4 people tomorrow at 7 PM",
        "action_taken": "booking_confirmed",
        "created_at": "2024-02-26T10:15:00Z"
      }
    ]
  }
}
```

---

### Update Request Status

```http
PATCH /api/concierge/requests/:id
Content-Type: application/json

{
  "status": "completed",
  "response": "Your booking has been confirmed"
}
```

**Valid Statuses:**
- `pending`: Received, awaiting processing
- `processing`: Being handled by agent
- `completed`: Successfully resolved
- `failed`: Unable to fulfill

**Response (200):**
```json
{
  "success": true,
  "data": {
    "id": 1,
    "status": "completed",
    "updated_at": "2024-02-26T10:30:00Z"
  }
}
```

---

## Analytics

### Social Media Analytics

```http
GET /api/analytics/social-media
```

**Response (200):**
```json
{
  "success": true,
  "data": [
    {
      "platform": "twitter",
      "status": "published",
      "count": 10
    },
    {
      "platform": "instagram",
      "status": "published",
      "count": 5
    }
  ]
}
```

---

### Concierge Analytics

```http
GET /api/analytics/concierge
```

**Response (200):**
```json
{
  "success": true,
  "data": [
    {
      "request_type": "booking",
      "status": "completed",
      "count": 45,
      "avg_duration_seconds": 600
    },
    {
      "request_type": "information",
      "status": "completed",
      "count": 120,
      "avg_duration_seconds": 120
    }
  ]
}
```

---

## Error Responses

All errors follow this format:

```json
{
  "error": "Descriptive error message"
}
```

**Common Status Codes:**
- `200`: Success
- `201`: Created
- `202`: Accepted
- `400`: Bad request (validation error)
- `404`: Resource not found
- `500`: Server error

---

## Authentication (Future)

Production deployment should include JWT authentication:

```bash
Authorization: Bearer <jwt_token>
```

---

## Rate Limiting (Future)

Plan for implementing rate limits per user/IP:
- Social Media: 100 requests/hour
- Concierge: 50 requests/hour

---

## Testing

Use curl or Postman to test endpoints:

```bash
# Test health
curl http://localhost:3000/health

# Create social media post
curl -X POST http://localhost:3000/api/social-media/post \
  -H "Content-Type: application/json" \
  -d '{"platform":"twitter","content":"Hello World!"}'

# Create concierge request
curl -X POST http://localhost:3000/api/concierge/request \
  -H "Content-Type: application/json" \
  -d '{"user_id":"test123","request_type":"information","description":"What time do you close?"}'
```

---

## Deployment

See [Terraform README](../terraform/README.md) for AWS deployment instructions.
