# Crystal Clear Voices - Complete Deployment Guide

End-to-end deployment guide for the social media + concierge agent system.

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                                                                 │
│                   CLIENT / API CONSUMERS                        │
│                                                                 │
└───────────────────────────┬─────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────────┐
│                                                                 │
│          EXPRESS.JS API SERVER (api-server/index.js)           │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │  POST /api/social-media/post                             │  │
│  │  POST /api/concierge/request                             │  │
│  │  GET  /api/*/posts|requests                              │  │
│  │  PATCH /api/*/posts|requests/:id                         │  │
│  └──────────────────────────────────────────────────────────┘  │
└───────────────────────────┬─────────────────────────────────────┘
           │                │                │
    ┌──────▼────────────────▼────────────────▼─────┐
    │  RDS AURORA POSTGRESQL CLUSTER (AWS)        │
    │  ├── social_media_posts                      │
    │  ├── concierge_requests                      │
    │  └── concierge_responses                     │
    └──────────────────────────────────────────────┘
           │                │
    ┌──────▼──────┐  ┌─────▼───────────────────┐
    │   n8n Flow  │  │   n8n Webhook Triggers  │
    │             │  │                         │
    │ Social Media │  │ Concierge Processing   │
    │ Publishing  │  │ AI Responses / Routing  │
    └─────────────┘  └─────────────────────────┘
```

---

## Prerequisites

- AWS Account with credentials
- Terraform installed (`brew install terraform`)
- AWS CLI installed (`brew install awscli`)
- Node.js 18+ installed
- n8n instance (cloud.n8n.io or self-hosted)
- Domain configured for DNS (optional but recommended)

---

## Phase 1: AWS Infrastructure Setup (Terraform)

### 1.1 Prepare AWS Credentials

```bash
# Configure AWS CLI
aws configure

# You'll be prompted for:
# - AWS Access Key ID
# - AWS Secret Access Key
# - Default region: us-east-1
# - Output format: json
```

### 1.2 Get VPC & Subnet Information

```bash
# List VPCs
aws ec2 describe-vpcs --query 'Vpcs[*].[VpcId, IsDefault]' --output table

# List subnets for your VPC
aws ec2 describe-subnets --filters "Name=vpc-id,Values=vpc-xxxxx" \
  --query 'Subnets[*].[SubnetId, AvailabilityZone, CidrBlock]' --output table
```

### 1.3 Deploy Infrastructure

```bash
# Navigate to terraform directory
cd terraform

# Copy example configuration
cp terraform.tfvars.example terraform.tfvars

# Edit with your values
# - vpc_id: from step 1.2
# - subnet_ids: at least 2 from the list
# - domain_name: your domain (e.g., voice.thediscobass.com)
nano terraform.tfvars

# Initialize Terraform
terraform init

# Preview changes
terraform plan -out=tfplan

# Apply infrastructure
terraform apply tfplan

# Save outputs (important!)
terraform output > deployment.outputs.txt
```

**Outputs to save:**
- `rds_cluster_endpoint`
- `social_media_agent_public_ip`
- `concierge_agent_public_ip`
- `api_gateway_invite_url`

---

## Phase 2: API Server Setup

### 2.1 Configure Environment

```bash
# Navigate to API server directory
cd api-server

# Copy environment template
cp .env.example .env

# Edit .env with database and API credentials
nano .env
```

**Required values from Terraform:**
```bash
DB_HOST=[rds_cluster_endpoint from terraform output]
DB_NAME=crystalcleardb
DB_USER=postgres
DB_PASSWORD=[database password from terraform output]
```

### 2.2 Deploy to EC2 Instance

Option A: SSH into instance and deploy manually

```bash
# SSH into one of the agent EC2 instances
ssh -i your-key.pem ec2-user@[social-media-agent-public-ip]

# Or into a dedicated API server (if deployed separately)
ssh -i your-key.pem ec2-user@[api-server-public-ip]

# Clone or upload this repository
git clone https://github.com/the-steele-zone/crystal-clear-voices.git
cd crystal-clear-voices/api-server

# Install dependencies
npm install

# Copy environment file
cp .env.example .env
# Edit .env with your credentials
nano .env

# Start service
npm start

# Or use PM2 for production
npm install -g pm2
pm2 start index.js --name "crystal-clear-voices-api"
pm2 save
pm2 startup
```

Option B: Deploy using Terraform user_data (automatic)

The Terraform configuration includes user_data scripts that automatically:
1. Install Node.js and npm
2. Clone repository (if applicable)
3. Install dependencies
4. Start application

Check EC2 instance logs:
```bash
ssh -i your-key.pem ec2-user@[instance-ip]
sudo tail -f /var/log/user-data.log
```

### 2.3 Verify API Server

```bash
# Test health endpoint
curl http://[api-server-public-ip]:3000/health

# Expected response:
# {"status":"healthy","service":"Crystal Clear Voices API","timestamp":"..."}
```

---

## Phase 3: n8n Workflow Setup

### 3.1 Start n8n Instance

**Option A: Cloud.n8n.io (Recommended)**
1. Go to [cloud.n8n.io](https://cloud.n8n.io)
2. Sign up / log in
3. Create new workspace

**Option B: Self-hosted n8n**
```bash
docker run -it --rm --name n8n -p 5678:5678 \
  -v ~/.n8n:/home/node/.n8n \
  n8nio/n8n
```
Access at http://localhost:5678

### 3.2 Import Workflows

**In n8n Dashboard:**
1. Click **Workflows** → **Import from URL**
2. Use: `https://github.com/the-steele-zone/crystal-clear-voices/n8n-workflows/social-media-agent.json`
3. Click **Open** if it prompts

Repeat for concierge workflow.

**Or import manually:**
1. Go to **Workflows**
2. Click **+** → **Import**
3. Select JSON file from `n8n-workflows/` folder

### 3.3 Configure Credentials

**Social Media Agent Workflow:**

1. In the workflow, click nodes that have credential icons
2. Add credentials for each service:
   - **PostgreSQL**: Connection to RDS
   - **Social Media APIs**: Twitter, Instagram, Facebook, LinkedIn tokens
   - **HTTP Request nodes**: Any API authentication

**Concierge Agent Workflow:**

1. Add **PostgreSQL** credentials
2. Add **OpenAI** credentials (for information requests)
3. Add **Booking Service API** credentials (your booking system)
4. Add **Email** credentials (SMTP for notifications)

### 3.4 Configure Webhooks

For each workflow:

1. Click **Trigger node** (usually at the start)
2. Copy the webhook URL
3. Update your API server configuration:

```bash
# In your API server code or environment:

# Social Media webhook
SOCIAL_MEDIA_WEBHOOK_URL=https://n8n.example.com/webhook/social-media-webhook

# Concierge webhook
CONCIERGE_WEBHOOK_URL=https://n8n.example.com/webhook/concierge-webhook
```

### 3.5 Test Workflows

**Social Media Test:**
```bash
curl -X POST https://n8n.example.com/webhook/social-media-webhook \
  -H "Content-Type: application/json" \
  -d '{
    "platform": "twitter",
    "content": "Testing Crystal Clear Voices!"
  }'
```

**Concierge Test:**
```bash
curl -X POST https://n8n.example.com/webhook/concierge-webhook \
  -H "Content-Type: application/json" \
  -d '{
    "user_id": "test_123",
    "request_type": "information",
    "description": "What are your hours?"
  }'
```

---

## Phase 4: Domain & DNS Configuration

### 4.1 Point Domain to API

```bash
# For API Gateway
# Create CNAME record:
# api.voice.thediscobass.com → [api_gateway_invoke_url]

# For Direct EC2
# Create A record:
# api.voice.thediscobass.com → [api-server-public-ip]

# For n8n
# Create CNAME record:
# n8n.voice.thediscobass.com → cloud.n8n.io (or your n8n host)
```

### 4.2 SSL/TLS Certificate

Using AWS Certificate Manager:
```bash
# Request certificate
aws acm request-certificate \
  --domain-name voice.thediscobass.com \
  --subject-alternative-names \
    api.voice.thediscobass.com \
    n8n.voice.thediscobass.com \
  --validation-method DNS
```

---

## Phase 5: Integration Testing

### Full workflow test:

```bash
# 1. Create social media post via API
curl -X POST http://api.voice.thediscobass.com/api/social-media/post \
  -H "Content-Type: application/json" \
  -d '{
    "platform": "twitter",
    "content": "Hello from Crystal Clear Voices!",
    "hashtags": ["crystal", "voices"]
  }'

# 2. Create concierge request
curl -X POST http://api.voice.thediscobass.com/api/concierge/request \
  -H "Content-Type: application/json" \
  -d '{
    "user_id": "test_001",
    "request_type": "booking",
    "description": "Book a dinner reservation for 4 at my favorite restaurant",
    "priority": "high"
  }'

# 3. Check request status
curl http://api.voice.thediscobass.com/api/concierge/requests/1

# 4. Get analytics
curl http://api.voice.thediscobass.com/api/analytics/social-media
curl http://api.voice.thediscobass.com/api/analytics/concierge
```

---

## Phase 6: Monitoring & Maintenance

### View Logs

**API Server Logs:**
```bash
# SSH into instance
ssh -i your-key.pem ec2-user@[api-server-ip]

# View application logs
pm2 logs crystal-clear-voices-api

# Or systemd logs
sudo journalctl -u crystal-clear-voices -f
```

**n8n Logs:**
- View execution history in n8n dashboard
- Set up error notifications to Slack/Email

**Database Logs:**
```bash
# Check RDS CloudWatch logs
aws logs tail /aws/rds/instance/crystal-clear-voices-cluster/postgresql
```

### Database Backups

```bash
# Automated snapshots (7 days retention)
# Configured in Terraform

# Manual snapshot
aws rds create-db-cluster-snapshot \
  --db-cluster-identifier crystal-clear-voices-cluster \
  --db-cluster-snapshot-identifier manual-backup-$(date +%F)
```

### Auto-scaling (Optional)

```bash
# Configure auto-scaling group in Terraform for production
# Add to main.tf:

resource "aws_autoscaling_group" "api_servers" {
  # ... configuration
}
```

---

## Phase 7: Production Checklist

- [ ] Terraform infrastructure deployed
- [ ] RDS database accessible
- [ ] API server running and health checks passing
- [ ] n8n workflows imported and configured
- [ ] All credentials stored in .env (git-ignored)
- [ ] SSL/TLS certificates configured
- [ ] DNS records pointing to services
- [ ] Monitoring and alerts configured
- [ ] Database backups enabled
- [ ] Load testing completed
- [ ] Security groups properly restricted
- [ ] Cost monitoring set up (AWS Budgets)

---

## Rollback Procedure

If something goes wrong:

```bash
# Destroy all infrastructure
cd terraform
terraform destroy

# This will prompt for confirmation and delete:
# - EC2 instances
# - RDS cluster
# - Security groups
# - API Gateway
# - All associated resources
```

---

## Cost Estimation

**Monthly costs (approximate):**
- 2x t3.medium EC2 instances: $30
- RDS Aurora (db.t3.micro): $20
- Data transfer: $10
- API Gateway: $3.50
- **Total: ~$63.50/month**

See [AWS Pricing Calculator](https://calculator.aws/) for exact estimates.

---

## Troubleshooting

### Database connection refused
```bash
# Check security group allows traffic from EC2
aws ec2 describe-security-groups --group-ids sg-xxxxx

# Test connection
psql -h [rds-endpoint] -U postgres -d crystalcleardb
```

### n8n webhooks not firing
```bash
# Check webhook URL is accessible
curl https://n8n.example.com/webhook/social-media-webhook

# View n8n execution logs
# Dashboard → Workflows → Click workflow → Executions
```

### API server not starting
```bash
# Check logs
pm2 logs crystal-clear-voices-api

# Verify environment variables
echo $DB_HOST
echo $DB_NAME

# Check database connection
npm run test:db
```

---

## Next Steps

1. **Custom domain setup** - Point your DNS to the API
2. **Authentication** - Implement JWT tokens for API security
3. **Rate limiting** - Add request throttling per user
4. **Caching** - Implement Redis for performance
5. **Multi-region** - Deploy to additional AWS regions
6. **Analytics dashboard** - Build web dashboard for metrics
7. **Mobile app** - Create mobile frontend for concierge

---

## Support

For issues or questions:
1. Check logs in `/var/log` or PM2
2. Review [API Documentation](./api-server/README.md)
3. Check [n8n Workflows](./n8n-workflows/README.md)
4. Review [Terraform Configuration](./terraform/README.md)
