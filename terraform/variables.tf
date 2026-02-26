variable "aws_region" {
  description = "AWS region for resources"
  type        = string
  default     = "us-east-1"
}

variable "environment" {
  description = "Environment name (dev, staging, prod)"
  type        = string
  default     = "prod"
}

variable "project_name" {
  description = "Project name for resource naming"
  type        = string
  default     = "crystal-clear-voices"
}

variable "domain_name" {
  description = "Domain name for the API and agents"
  type        = string
}

variable "vpc_id" {
  description = "VPC ID to deploy resources into"
  type        = string
}

variable "subnet_ids" {
  description = "List of subnet IDs for multi-AZ deployment"
  type        = list(string)
}

variable "instance_type" {
  description = "EC2 instance type for agent servers"
  type        = string
  default     = "t3.medium"
}

variable "db_instance_class" {
  description = "RDS instance type"
  type        = string
  default     = "db.t3.micro"
}

variable "db_allocated_storage" {
  description = "RDS storage in GB"
  type        = number
  default     = 20
}

variable "db_name" {
  description = "Initial database name"
  type        = string
  default     = "crystalcleardb"
}

variable "tags" {
  description = "Common tags for all resources"
  type        = map(string)
  default = {
    Project     = "crystal-clear-voices"
    Environment = "production"
    ManagedBy   = "terraform"
  }
}
