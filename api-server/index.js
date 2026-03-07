import express from 'express';
import cors from 'express-cors';
import pkg from 'pg';
import dotenv from 'dotenv';
import axios from 'axios';
import Joi from 'joi';
import { v4 as uuidv4 } from 'uuid';
import winston from 'winston';

dotenv.config();
const { Client } = pkg;

// ============================================================================
// LOGGER SETUP
// ============================================================================

const logger = winston.createLogger({
  level: 'info',
  format: winston.format.json(),
  transports: [
    new winston.transports.Console({
      format: winston.format.combine(
        winston.format.colorize(),
        winston.format.simple()
      )
    }),
    new winston.transports.File({ filename: 'error.log', level: 'error' }),
    new winston.transports.File({ filename: 'combined.log' })
  ]
});

// ============================================================================
// DATABASE CONNECTION
// ============================================================================

const db = new Client({
  host: process.env.DB_HOST,
  port: process.env.DB_PORT || 5432,
  database: process.env.DB_NAME,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
});

async function connectDB() {
  try {
    await db.connect();
    logger.info('✅ Database connected');
    await initSchema();
  } catch(err) {
    logger.error('❌ Database connection failed:', err.message);
    setTimeout(connectDB, 5000);
  }
}

async function initSchema() {
  try {
    await db.query(`
      CREATE TABLE IF NOT EXISTS social_media_posts (
        id SERIAL PRIMARY KEY,
        platform TEXT NOT NULL,
        content TEXT NOT NULL,
        media_urls TEXT[],
        hashtags TEXT[],
        posted_at TIMESTAMP,
        status TEXT DEFAULT 'draft',
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS concierge_requests (
        id SERIAL PRIMARY KEY,
        request_id UUID UNIQUE NOT NULL,
        user_id TEXT NOT NULL,
        request_type TEXT NOT NULL,
        description TEXT,
        priority TEXT DEFAULT 'normal',
        status TEXT DEFAULT 'pending',
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS concierge_responses (
        id SERIAL PRIMARY KEY,
        request_id INT REFERENCES concierge_requests(id),
        response TEXT,
        action_taken TEXT,
        created_at TIMESTAMP DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS api_logs (
        id SERIAL PRIMARY KEY,
        method TEXT NOT NULL,
        endpoint TEXT NOT NULL,
        status_code INT,
        duration_ms INT,
        created_at TIMESTAMP DEFAULT NOW()
      );
    `);
    logger.info('✅ Database schema initialized');
  } catch(err) {
    if(!err.message.includes('already exists')) {
      logger.error('Schema initialization error:', err.message);
    }
  }
}

// ============================================================================
// EXPRESS APP SETUP
// ============================================================================

const app = express();
const port = process.env.PORT || 3000;

app.use(express.json());
app.use(cors());

// Request logging middleware
app.use((req, res, next) => {
  const start = Date.now();
  res.on('finish', () => {
    const duration = Date.now() - start;
    logger.info(`${req.method} ${req.path} - ${res.statusCode} (${duration}ms)`);
  });
  next();
});

// ============================================================================
// API KEY AUTH — applied to all /api/* routes
// Set API_KEY env var (generate: openssl rand -hex 32).
// When unset, auth is skipped with a startup warning — local dev only.
// ============================================================================

const API_KEY = process.env.API_KEY;

if (!API_KEY) {
  logger.warn('API_KEY not set — /api/* routes are unauthenticated. Set API_KEY in .env for production.');
}

app.use('/api', (req, res, next) => {
  if (!API_KEY) return next();
  const provided = req.headers['x-api-key'];
  if (!provided || provided !== API_KEY) {
    return res.status(401).json({ error: 'Unauthorized — missing or invalid X-API-Key header' });
  }
  next();
});

// ============================================================================
// VALIDATION SCHEMAS
// ============================================================================

const socialMediaPostSchema = Joi.object({
  platform: Joi.string().valid('twitter', 'instagram', 'facebook', 'linkedin').required(),
  content: Joi.string().min(1).max(5000).required(),
  media_urls: Joi.array().items(Joi.string().uri()).optional(),
  hashtags: Joi.array().items(Joi.string()).optional(),
  scheduled_time: Joi.date().iso().optional()
});

const conciergeRequestSchema = Joi.object({
  user_id: Joi.string().required(),
  request_type: Joi.string().valid('booking', 'information', 'support').required(),
  description: Joi.string().min(1).max(2000).required(),
  priority: Joi.string().valid('normal', 'high').optional()
});

// ============================================================================
// SOCIAL MEDIA AGENT ROUTES
// ============================================================================

// Health check
app.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    service: 'Crystal Clear Voices API',
    timestamp: new Date().toISOString()
  });
});

// Create social media post
app.post('/api/social-media/post', async (req, res) => {
  try {
    const { error, value } = socialMediaPostSchema.validate(req.body);
    if(error) {
      return res.status(400).json({ error: error.details[0].message });
    }

    const { platform, content, media_urls, hashtags, scheduled_time } = value;

    const result = await db.query(
      `INSERT INTO social_media_posts (platform, content, media_urls, hashtags, posted_at, status)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING id, platform, content, status`,
      [
        platform,
        content,
        media_urls || [],
        hashtags || [],
        scheduled_time || null,
        scheduled_time ? 'scheduled' : 'draft'
      ]
    );

    // Trigger n8n workflow
    try {
      await axios.post(
        `${process.env.N8N_WEBHOOK_URL || 'http://localhost:5678'}/webhook/social-media-webhook`,
        { platform, content, scheduled_time },
        { timeout: 5000 }
      );
      logger.info(`Posted to ${platform}: ${content.substring(0, 50)}...`);
    } catch(webhookErr) {
      logger.warn(`N8N webhook call failed: ${webhookErr.message}`);
    }

    res.status(201).json({
      success: true,
      data: result.rows[0]
    });
  } catch(err) {
    logger.error('POST /api/social-media/post error:', err.message);
    res.status(500).json({ error: 'Failed to create post' });
  }
});

// Get social media posts
app.get('/api/social-media/posts', async (req, res) => {
  try {
    const { platform, status } = req.query;
    let query = 'SELECT * FROM social_media_posts WHERE 1=1';
    const params = [];

    if(platform) {
      query += ` AND platform = $${params.length + 1}`;
      params.push(platform);
    }
    if(status) {
      query += ` AND status = $${params.length + 1}`;
      params.push(status);
    }

    query += ' ORDER BY created_at DESC LIMIT 100';

    const result = await db.query(query, params);
    res.json({
      success: true,
      count: result.rows.length,
      data: result.rows
    });
  } catch(err) {
    logger.error('GET /api/social-media/posts error:', err.message);
    res.status(500).json({ error: 'Failed to fetch posts' });
  }
});

// Get single post
app.get('/api/social-media/posts/:id', async (req, res) => {
  try {
    const result = await db.query('SELECT * FROM social_media_posts WHERE id = $1', [req.params.id]);
    if(result.rows.length === 0) {
      return res.status(404).json({ error: 'Post not found' });
    }
    res.json({
      success: true,
      data: result.rows[0]
    });
  } catch(err) {
    logger.error('GET /api/social-media/posts/:id error:', err.message);
    res.status(500).json({ error: 'Failed to fetch post' });
  }
});

// Update post status
app.patch('/api/social-media/posts/:id', async (req, res) => {
  try {
    const { status } = req.body;
    if(!['draft', 'scheduled', 'published', 'failed'].includes(status)) {
      return res.status(400).json({ error: 'Invalid status' });
    }

    const result = await db.query(
      'UPDATE social_media_posts SET status = $1, updated_at = NOW() WHERE id = $2 RETURNING *',
      [status, req.params.id]
    );

    if(result.rows.length === 0) {
      return res.status(404).json({ error: 'Post not found' });
    }

    res.json({
      success: true,
      data: result.rows[0]
    });
  } catch(err) {
    logger.error('PATCH /api/social-media/posts/:id error:', err.message);
    res.status(500).json({ error: 'Failed to update post' });
  }
});

// ============================================================================
// CONCIERGE AGENT ROUTES
// ============================================================================

// Create concierge request
app.post('/api/concierge/request', async (req, res) => {
  try {
    const { error, value } = conciergeRequestSchema.validate(req.body);
    if(error) {
      return res.status(400).json({ error: error.details[0].message });
    }

    const requestId = uuidv4();
    const { user_id, request_type, description, priority } = value;

    const result = await db.query(
      `INSERT INTO concierge_requests (request_id, user_id, request_type, description, priority, status)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING id, request_id, user_id, request_type, status`,
      [requestId, user_id, request_type, description, priority || 'normal', 'pending']
    );

    // Trigger n8n workflow
    try {
      await axios.post(
        `${process.env.N8N_WEBHOOK_URL || 'http://localhost:5678'}/webhook/concierge-webhook`,
        { user_id, request_type, description, priority },
        { timeout: 5000 }
      );
      logger.info(`Concierge request created: ${requestId}`);
    } catch(webhookErr) {
      logger.warn(`N8N webhook call failed: ${webhookErr.message}`);
    }

    res.status(202).json({
      success: true,
      data: result.rows[0]
    });
  } catch(err) {
    logger.error('POST /api/concierge/request error:', err.message);
    res.status(500).json({ error: 'Failed to create request' });
  }
});

// Get concierge requests
app.get('/api/concierge/requests', async (req, res) => {
  try {
    const { user_id, status, request_type } = req.query;
    let query = 'SELECT * FROM concierge_requests WHERE 1=1';
    const params = [];

    if(user_id) {
      query += ` AND user_id = $${params.length + 1}`;
      params.push(user_id);
    }
    if(status) {
      query += ` AND status = $${params.length + 1}`;
      params.push(status);
    }
    if(request_type) {
      query += ` AND request_type = $${params.length + 1}`;
      params.push(request_type);
    }

    query += ' ORDER BY created_at DESC LIMIT 100';

    const result = await db.query(query, params);
    res.json({
      success: true,
      count: result.rows.length,
      data: result.rows
    });
  } catch(err) {
    logger.error('GET /api/concierge/requests error:', err.message);
    res.status(500).json({ error: 'Failed to fetch requests' });
  }
});

// Get single request with responses
app.get('/api/concierge/requests/:id', async (req, res) => {
  try {
    const reqResult = await db.query('SELECT * FROM concierge_requests WHERE id = $1 OR request_id = $2', [req.params.id, req.params.id]);
    
    if(reqResult.rows.length === 0) {
      return res.status(404).json({ error: 'Request not found' });
    }

    const request = reqResult.rows[0];
    const respResult = await db.query('SELECT * FROM concierge_responses WHERE request_id = $1 ORDER BY created_at DESC', [request.id]);

    res.json({
      success: true,
      data: {
        request,
        responses: respResult.rows
      }
    });
  } catch(err) {
    logger.error('GET /api/concierge/requests/:id error:', err.message);
    res.status(500).json({ error: 'Failed to fetch request' });
  }
});

// Update request status
app.patch('/api/concierge/requests/:id', async (req, res) => {
  try {
    const { status, response } = req.body;
    if(!['pending', 'processing', 'completed', 'failed'].includes(status)) {
      return res.status(400).json({ error: 'Invalid status' });
    }

    const result = await db.query(
      'UPDATE concierge_requests SET status = $1, updated_at = NOW() WHERE id = $2 OR request_id = $3 RETURNING *',
      [status, req.params.id, req.params.id]
    );

    if(result.rows.length === 0) {
      return res.status(404).json({ error: 'Request not found' });
    }

    if(response) {
      await db.query(
        'INSERT INTO concierge_responses (request_id, response, action_taken) VALUES ($1, $2, $3)',
        [result.rows[0].id, response, 'manual_response']
      );
    }

    res.json({
      success: true,
      data: result.rows[0]
    });
  } catch(err) {
    logger.error('PATCH /api/concierge/requests/:id error:', err.message);
    res.status(500).json({ error: 'Failed to update request' });
  }
});

// ============================================================================
// METRICS & ANALYTICS ROUTES
// ============================================================================

app.get('/api/analytics/social-media', async (req, res) => {
  try {
    const result = await db.query(`
      SELECT 
        platform,
        status,
        COUNT(*) as count
      FROM social_media_posts
      GROUP BY platform, status
      ORDER BY platform, status
    `);
    res.json({ success: true, data: result.rows });
  } catch(err) {
    logger.error('Analytics error:', err.message);
    res.status(500).json({ error: 'Failed to fetch analytics' });
  }
});

app.get('/api/analytics/concierge', async (req, res) => {
  try {
    const result = await db.query(`
      SELECT 
        request_type,
        status,
        COUNT(*) as count,
        AVG(EXTRACT(EPOCH FROM (updated_at - created_at))) as avg_duration_seconds
      FROM concierge_requests
      GROUP BY request_type, status
      ORDER BY request_type, status
    `);
    res.json({ success: true, data: result.rows });
  } catch(err) {
    logger.error('Analytics error:', err.message);
    res.status(500).json({ error: 'Failed to fetch analytics' });
  }
});

// ============================================================================
// ERROR HANDLING
// ============================================================================

app.use((err, req, res, next) => {
  logger.error('Unhandled error:', err.message);
  res.status(500).json({ error: 'Internal server error' });
});

app.use((req, res) => {
  res.status(404).json({ error: 'Route not found' });
});

// ============================================================================
// SERVER START
// ============================================================================

connectDB().then(() => {
  app.listen(port, () => {
    logger.info(`🚀 Crystal Clear Voices API listening on port ${port}`);
    logger.info(`📊 Health check: GET http://localhost:${port}/health`);
    logger.info(`📱 Social media: POST http://localhost:${port}/api/social-media/post`);
    logger.info(`🔔 Concierge: POST http://localhost:${port}/api/concierge/request`);
  });
}).catch(err => {
  logger.error('Failed to start server:', err.message);
  process.exit(1);
});

// Graceful shutdown
process.on('SIGINT', async () => {
  logger.info('Shutting down gracefully...');
  await db.end();
  process.exit(0);
});
