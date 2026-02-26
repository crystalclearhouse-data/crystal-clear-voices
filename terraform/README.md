# Terraform Deployment Guide

## Prerequisites

- Terraform >= 1.0
- AWS CLI configured with credentials
- VPC ID and Subnet IDs from AWS

## Setup

1. **Copy the example configuration:**
   ```bash
   cp terraform/terraform.tfvars.example terraform/terraform.tfvars
   ```

2. **Edit `terraform/terraform.tfvars` with your AWS details:**
   ```hcl
   domain_name = "voice.thediscobass.com"
   vpc_id = "vpc-xxxxx"
   subnet_ids = ["subnet-xxxxx", "subnet-yyyyy"]
   ```

3. **Initialize Terraform:**
   ```bash
   cd terraform
   terraform init
   ```

4. **Review the plan:**
   ```bash
   terraform plan -out=tfplan
   ```

5. **Apply the configuration:**
   ```bash
   terraform apply tfplan
   ```

## Resources Created

- **RDS Aurora PostgreSQL Cluster** for persistent data
- **2x EC2 Instances** (Social Media Agent & Concierge Agent)
- **Security Groups** for network access
- **IAM Roles & Policies** for AWS service access
- **API Gateway** for HTTP endpoints

## Outputs

After deployment, Terraform will output:
- RDS cluster endpoint
- Agent server details (IDs, IPs)
- API Gateway endpoint
- Database password (save securely!)

## Access Agent APIs

**Social Media Agent:**
```bash
curl http://<social-media-agent-public-ip>:3000/health
```

**Concierge Agent:**
```bash
curl http://<concierge-agent-public-ip>:3001/health
```

## Cleanup

To destroy all resources:
```bash
terraform destroy
```

## Notes

- Database password is randomly generated and marked as sensitive in output
- Use `terraform output db_password_secret` to retrieve it (will be hidden after first apply)
- Store credentials in AWS Secrets Manager for production use
- Backup RDS snapshots are retained for 7 days
