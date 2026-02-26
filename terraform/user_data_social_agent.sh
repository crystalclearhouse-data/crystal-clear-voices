#!/bin/bash
set -euo pipefail

# Update system
yum update -y
yum install -y nodejs npm git curl postgresql15-client

# Log output
exec > >(tee /var/log/user-data.log)
exec 2>&1

echo "Starting social media agent setup..."

# Install Node app
mkdir -p /opt/crystal-clear-voices/social-media-agent
cd /opt/crystal-clear-voices/social-media-agent

# Create a basic Node.js API server
cat > package.json << 'PACKAGE_JSON'
{
  "name": "social-media-agent",
  "version": "1.0.0",
  "type": "module",
  "main": "index.js",
  "scripts": {
    "start": "node index.js",
    "dev": "node --watch index.js"
  },
  "dependencies": {
    "express": "^4.18.2",
    "axios": "^1.4.0",
    "pg": "^8.11.0",
    "dotenv": "^16.3.1"
  }
}
PACKAGE_JSON

# Create environment file
cat > .env << ENV_FILE
DB_HOST=${db_endpoint}
DB_PORT=5432
DB_NAME=${db_name}
DB_USER=postgres
DB_PASSWORD=$RDS_PASSWORD
NODE_ENV=production
PORT=3000
AGENT_TYPE=social-media
AGENT_NAME=Crystal Clear Voices - Social Media
ENV_FILE

# Create main application
cat > index.js << 'INDEX_JS'
import express from 'express';
import pkg from 'pg';
import dotenv from 'dotenv';

dotenv.config();
const { Client } = pkg;

const app = express();
const port = process.env.PORT || 3000;

let db;

// Initialize database connection
async function initDB() {
  db = new Client({
    host: process.env.DB_HOST,
    port: process.env.DB_PORT,
    database: process.env.DB_NAME,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
  });
  
  try {
    await db.connect();
    console.log('✅ Database connected');
    await initSchema();
  } catch(e) {
    console.error('❌ DB connection failed:', e.message);
    setTimeout(initDB, 5000);
  }
}

async function initSchema() {
  await db.query(`
    CREATE TABLE IF NOT EXISTS social_media_posts (
      id SERIAL PRIMARY KEY,
      platform TEXT NOT NULL,
      content TEXT NOT NULL,
      posted_at TIMESTAMP DEFAULT NOW(),
      status TEXT DEFAULT 'draft'
    );
  `);
  console.log('✅ Database schema initialized');
}

// Middleware
app.use(express.json());

// Health check
app.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    agent: process.env.AGENT_NAME,
    timestamp: new Date().toISOString()
  });
});

// Get all posts
app.get('/posts', async (req, res) => {
  try {
    const result = await db.query('SELECT * FROM social_media_posts ORDER BY posted_at DESC');
    res.json(result.rows);
  } catch(e) {
    res.status(500).json({ error: e.message });
  }
});

// Create new post
app.post('/posts', async (req, res) => {
  const { platform, content } = req.body;
  try {
    const result = await db.query(
      'INSERT INTO social_media_posts (platform, content) VALUES ($1, $2) RETURNING *',
      [platform, content]
    );
    res.status(201).json(result.rows[0]);
  } catch(e) {
    res.status(400).json({ error: e.message });
  }
});

// Publish post
app.post('/posts/:id/publish', async (req, res) => {
  try {
    const result = await db.query(
      'UPDATE social_media_posts SET status = $1 WHERE id = $2 RETURNING *',
      ['published', req.params.id]
    );
    res.json(result.rows[0]);
  } catch(e) {
    res.status(400).json({ error: e.message });
  }
});

app.listen(port, () => {
  console.log(`🚀 Social Media Agent listening on port ${port}`);
});

initDB();
INDEX_JS

npm install
echo "✅ Social media agent setup complete"
