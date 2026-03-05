# Crystal Clear Voices — Deployment Guide

End-to-end deployment guide for the Sophie AI voice concierge and social media automation system.

---

## Architecture Overview

```text
┌─────────────────────────────────────────────────────────────────┐
│                   CLIENT / API CONSUMERS                        │
└───────────────────────────┬─────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────────┐
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
    │  RDS AURORA POSTGRESQL CLUSTER (AWS)          │
    │  ├── social_media_posts                        │
    │  ├── concierge_requests                        │
    │  └── concierge_responses                       │
    └──────────────────────────────────────────────┘
           │                │
    ┌──────▼──────┐  ┌─────▼───────────────────┐
    │   n8n Flow  │  │   n8n Webhook Triggers  │
    │             │  │                         │
    │ Social Media│  │ Concierge Processing   │
    │ Publishing  │  │ AI Responses / Routing  │
    └─────────────┘  └─────────────────────────┘
```

---

## Prerequisites

- AWS account with credentials configured
- Terraform ≥ 1.5 (`brew install terraform`)
- AWS CLI (`brew install awscli`)
- Node.js 18+
- n8n instance (cloud.n8n.io or self-hosted Docker)
- Domain with DNS access (recommended for production)

---

## Phase 1: AWS Infrastructure Setup (Terraform)

### 1.1 Configure AWS CLI

```bash
aws configure
# Prompts: Access Key ID, Secret Access Key, region (us-east-1), output format (json)
```

### 1.2 Enumerate VPC and Subnets

```bash
aws ec2 describe-vpcs --query 'Vpcs[*].[VpcId, IsDefault]' --output table

aws ec2 describe-subnets \
  --filters "Name=vpc-id,Values=vpc-xxxxx" \
  --query 'Subnets[*].[SubnetId, AvailabilityZone, CidrBlock]' \
  --output table
```

### 1.3 Deploy Infrastructure

```bash
cd terraform
cp terraform.tfvars.example terraform.tfvars
# Edit terraform.tfvars: vpc_id, subnet_ids (≥2), domain_name, public_url

terraform init
terraform plan -out=tfplan
terraform apply tfplan
terraform output > deployment.outputs.txt
```

**Outputs to retain:**

- `rds_cluster_endpoint`
- `social_media_agent_public_ip`
- `concierge_agent_public_ip`
- `api_gateway_invoke_url`
- `twilio_voice_webhook_url`

---

## Phase 2: API Server Setup

### 2.1 Configure Environment

```bash
cd api-server
cp .env.example .env
# Populate DB_HOST, DB_NAME, DB_USER, DB_PASSWORD from Terraform outputs
```

**Required values from Terraform output:**

```bash
DB_HOST=<rds_cluster_endpoint>
DB_NAME=crystalcleardb
DB_USER=postgres
DB_PASSWORD=<from terraform output>
```

### 2.2 Deploy to EC2

**Option A — Manual SSH deploy:**

```bash
ssh -i your-key.pem ec2-user@<social-media-agent-public-ip>

git clone https://github.com/crystalclearhouse-data/crystal-clear-voices.git
cd crystal-clear-voices/api-server
npm install
cp .env.example .env  # populate credentials

# Production process manager
npm install -g pm2
pm2 start index.js --name "crystal-clear-voices-api"
pm2 save && pm2 startup
```

**Option B — Terraform user_data (automatic):**

The Terraform config includes `user_data` scripts that install Node.js, clone the repo,
install dependencies, and start the application. Monitor bootstrap via:

```bash
ssh -i your-key.pem ec2-user@<instance-ip>
sudo tail -f /var/log/user-data.log
```

### 2.3 Verify API Server

```bash
curl http://<api-server-public-ip>:3000/health
# Expected: {"status":"healthy","service":"Crystal Clear Voices API","timestamp":"..."}
```

---

## Phase 3: n8n Workflow Setup

### 3.1 Start n8n

**Option A — Cloud (recommended for production):**

1. Sign in at [cloud.n8n.io](https://cloud.n8n.io)
2. Create a new workspace

**Option B — Self-hosted Docker:**

```bash
docker run -it --rm --name n8n -p 5678:5678 \
  -v ~/.n8n:/home/node/.n8n \
  n8nio/n8n
```

Access at `http://localhost:5678`.

### 3.2 Import Workflows

1. n8n dashboard → **Workflows** → **Import**
2. Upload JSON files from `n8n-workflows/`

### 3.3 Configure Credentials

**Social Media workflow:**

- PostgreSQL connection to RDS / Supabase
- `META_PAGE_ACCESS_TOKEN`, `META_PAGE_ID`, `META_IG_USER_ID`
- `TIKTOK_ACCESS_TOKEN`, `TIKTOK_OPEN_ID`

**Concierge workflow:**

- PostgreSQL connection
- `ANTHROPIC_API_KEY` (Claude — `claude-sonnet-4-6`)
- `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`

### 3.4 Configure Webhooks

Copy the webhook URL from each trigger node and set the corresponding env var:

```bash
# Social media agent
SOCIAL_MEDIA_WEBHOOK_URL=https://n8n.example.com/webhook/social-media-webhook

# Concierge agent
CONCIERGE_WEBHOOK_URL=https://n8n.example.com/webhook/concierge-webhook
```

### 3.5 Test Workflows

```bash
# Social media
curl -X POST https://n8n.example.com/webhook/social-media-webhook \
  -H "Content-Type: application/json" \
  -d '{"platform":"instagram","content":"Testing Crystal Clear Voices!"}'

# Concierge
curl -X POST https://n8n.example.com/webhook/concierge-webhook \
  -H "Content-Type: application/json" \
  -d '{"user_id":"test_123","request_type":"information","description":"What are your hours?"}'
```

---

## Phase 4: Domain and DNS Configuration

### 4.1 DNS Records

```bash
# API Gateway
# CNAME: api.voice.thediscobass.com → <api_gateway_invoke_url>

# Direct EC2
# A:     api.voice.thediscobass.com → <api-server-public-ip>

# n8n (if self-hosted)
# CNAME: n8n.voice.thediscobass.com → <n8n-host>
```

### 4.2 TLS Certificate (ACM)

```bash
aws acm request-certificate \
  --domain-name voice.thediscobass.com \
  --subject-alternative-names \
    api.voice.thediscobass.com \
    n8n.voice.thediscobass.com \
  --validation-method DNS
```

---

## Phase 5: Integration Testing

```bash
# Create a social media post
curl -X POST http://api.voice.thediscobass.com/api/social-media/post \
  -H "Content-Type: application/json" \
  -d '{"platform":"instagram","content":"Hello from Crystal Clear Voices!"}'

# Submit a concierge request
curl -X POST http://api.voice.thediscobass.com/api/concierge/request \
  -H "Content-Type: application/json" \
  -d '{"user_id":"test_001","request_type":"information","description":"What are your hours?","priority":"normal"}'

# Poll request status
curl http://api.voice.thediscobass.com/api/concierge/requests/1

# Analytics
curl http://api.voice.thediscobass.com/api/analytics/social-media
curl http://api.voice.thediscobass.com/api/analytics/concierge
```

---

## Phase 6: Monitoring and Maintenance

### Application Logs

```bash
ssh -i your-key.pem ec2-user@<api-server-ip>
pm2 logs crystal-clear-voices-api
# or: sudo journalctl -u crystal-clear-voices -f
```

### n8n Execution Logs

- Dashboard → Workflows → click workflow → **Executions**
- Configure error notifications to Slack or Discord

### Database Logs (RDS CloudWatch)

```bash
aws logs tail /aws/rds/instance/crystal-clear-voices-cluster/postgresql
```

### Manual Database Snapshot

```bash
aws rds create-db-cluster-snapshot \
  --db-cluster-identifier crystal-clear-voices-cluster \
  --db-cluster-snapshot-identifier manual-backup-$(date +%F)
```

---

## Phase 7: Production Checklist

- [ ] Terraform infrastructure deployed
- [ ] RDS database accessible from EC2 security group
- [ ] API server running and health checks passing
- [ ] n8n workflows imported, credentials configured, and activated
- [ ] All secrets stored in `.env` (git-ignored)
- [ ] TLS certificates issued and attached
- [ ] DNS records resolving correctly
- [ ] Monitoring and failure alerts configured
- [ ] Automated RDS snapshots enabled (7-day retention)
- [ ] Load test completed for expected traffic volume
- [ ] Security groups restricted to minimum required ingress
- [ ] AWS Budgets alert configured

---

## Rollback

```bash
cd terraform
terraform destroy
# Destroys: EC2 instances, RDS cluster, security groups, API Gateway, and all associated resources
```

---

## Cost Estimate (Monthly)

| Resource | Cost |
| --- | --- |
| 2× t3.medium EC2 | ~$30 |
| RDS Aurora db.t3.micro | ~$20 |
| Data transfer | ~$10 |
| API Gateway | ~$3.50 |
| **Total** | **~$63.50** |

See [AWS Pricing Calculator](https://calculator.aws/) for project-specific estimates.

---

## Troubleshooting

### Database connection refused

```bash
aws ec2 describe-security-groups --group-ids sg-xxxxx
psql -h <rds-endpoint> -U postgres -d crystalcleardb
```

### n8n webhooks not firing

```bash
# Verify webhook URL is reachable
curl https://n8n.example.com/webhook/social-media-webhook

# Check execution history
# Dashboard → Workflows → click workflow → Executions
```

### API server not starting

```bash
pm2 logs crystal-clear-voices-api
echo $DB_HOST && echo $DB_NAME
npm run test:db
```

---

## References

- [API Server Documentation](./api-server/README.md)
- [n8n Workflow Documentation](./n8n-workflows/README.md)
- [Terraform Configuration](./terraform/README.md)
