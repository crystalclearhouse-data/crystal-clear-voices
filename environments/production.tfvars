# Crystal Clear Voices - Production Environment
# AWS Configuration
aws_region  = "us-east-1"

# Environment
environment = "prod"
project_name = "crystal-clear-voices"

# Network Configuration
vpc_id = "vpc-default"
subnet_ids = ["subnet-default-1", "subnet-default-2"]

# Domain
domain_name = "voice.thediscobass.com"

# Instance Configuration
instance_type = "t3.medium"

# Database Configuration
db_instance_class = "db.t3.micro"
db_allocated_storage = 20
db_name = "crystalcleardb"

# Tags
tags = {
  Project     = "crystal-clear-voices"
  Environment = "production"
  ManagedBy   = "terraform"
  Domain      = "voice.thediscobass.com"
}
