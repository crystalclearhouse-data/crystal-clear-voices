#!/bin/bash
set -euo pipefail

# Update system
yum update -y
yum install -y nodejs npm git curl postgresql15-client

# Log output
exec > >(tee /var/log/user-data.log)
exec 2>&1

echo "Starting concierge agent setup..."

# Install Node app
mkdir -p /opt/crystal-clear-voices/concierge-agent
cd /opt/crystal-clear-voices/concierge-agent

# Create a basic Node.js API server
cat > package.json << 'PACKAGE_JSON'
{
  "name": "concierge-agent",
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
PORT=3001
AGENT_TYPE=concierge
AGENT_NAME=Crystal Clear Voices - Concierge
ENV_FILE

# Create main application
cat > index.js << 'INDEX_JS'
import express from 'express';
import pkg from 'pg';
import dotenv from 'dotenv';

dotenv.config();
const { Client } = pkg;

const app = express();
const port = process.env.PORT || 3001;

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
    CREATE TABLE IF NOT EXISTS concierge_requests (
      id SERIAL PRIMARY KEY,
      user_id TEXT NOT NULL,
      request_type TEXT NOT NULL,
      description TEXT,
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

// Get all requests
app.get('/requests', async (req, res) => {
  try {
    const result = await db.query('SELECT * FROM concierge_requests ORDER BY created_at DESC');
    res.json(result.rows);
  } catch(e) {
    res.status(500).json({ error: e.message });
  }
});

// Create new request
app.post('/requests', async (req, res) => {
  const { user_id, request_type, description } = req.body;
  try {
    const result = await db.query(
      'INSERT INTO concierge_requests (user_id, request_type, description) VALUES ($1, $2, $3) RETURNING *',
      [user_id, request_type, description]
    );
    res.status(201).json(result.rows[0]);
  } catch(e) {
    res.status(400).json({ error: e.message });
  }
});

// Update request status
app.patch('/requests/:id', async (req, res) => {
  const { status, response } = req.body;
  try {
    const result = await db.query(
      'UPDATE concierge_requests SET status = $1, updated_at = NOW() WHERE id = $2 RETURNING *',
      [status, req.params.id]
    );
    
    if(response) {
      await db.query(
        'INSERT INTO concierge_responses (request_id, response) VALUES ($1, $2)',
        [req.params.id, response]
      );
    }
    
    res.json(result.rows[0]);
  } catch(e) {
    res.status(400).json({ error: e.message });
  }
});

// Get request details with responses
app.get('/requests/:id', async (req, res) => {
  try {
    const request = await db.query('SELECT * FROM concierge_requests WHERE id = $1', [req.params.id]);
    const responses = await db.query('SELECT * FROM concierge_responses WHERE request_id = $1', [req.params.id]);
    
    res.json({
      request: request.rows[0],
      responses: responses.rows
    });
  } catch(e) {
    res.status(500).json({ error: e.message });
  }
});

app.listen(port, () => {
  console.log(`🚀 Concierge Agent listening on port $${port}`);
});

initDB();
INDEX_JS

npm install
echo "✅ Concierge agent setup complete"
