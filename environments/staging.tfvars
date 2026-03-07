# Crystal Clear Voices — Staging Environment
# Mirrors production config; smaller instances to reduce cost.
# Apply: terraform apply -var-file=environments/staging.tfvars
aws_region   = "us-east-1"

environment  = "staging"
project_name = "crystal-clear-voices-staging"

# Network — share VPC with prod; use separate subnets when available
vpc_id     = "vpc-default"
subnet_ids = ["subnet-default-1", "subnet-default-2"]

# Domain
domain_name = "staging.voice.thediscobass.com"

# Instance — smaller than prod
instance_type     = "t3.small"
db_instance_class = "db.t3.micro"
db_allocated_storage = 10
db_name           = "crystalcleardb_staging"

# CORS — staging front-end origins
cors_allow_origins = ["https://staging.voice.thediscobass.com", "http://localhost:3000"]

# Tags
tags = {
  Project     = "crystal-clear-voices"
  Environment = "staging"
  ManagedBy   = "terraform"
  Domain      = "staging.voice.thediscobass.com"
}
