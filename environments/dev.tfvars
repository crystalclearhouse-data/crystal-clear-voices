# Crystal Clear Voices — Dev Environment
# Minimal infrastructure for development / integration testing.
# Apply: terraform apply -var-file=environments/dev.tfvars
aws_region   = "us-east-1"

environment  = "dev"
project_name = "crystal-clear-voices-dev"

vpc_id     = "vpc-default"
subnet_ids = ["subnet-default-1"]

# Domain
domain_name = "dev.voice.thediscobass.com"

# Smallest possible instances
instance_type     = "t3.micro"
db_instance_class = "db.t3.micro"
db_allocated_storage = 10
db_name           = "crystalcleardb_dev"

# CORS — allow localhost in dev
cors_allow_origins = ["https://dev.voice.thediscobass.com", "http://localhost:3000", "http://localhost:3001"]

# Tags
tags = {
  Project     = "crystal-clear-voices"
  Environment = "dev"
  ManagedBy   = "terraform"
  Domain      = "dev.voice.thediscobass.com"
}
