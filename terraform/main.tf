terraform {
  required_version = ">= 1.0"
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
  }
  # Uncomment and configure for remote state
  # backend "s3" {
  #   bucket         = "crystal-clear-voices-terraform-state"
  #   key            = "prod/terraform.tfstate"
  #   region         = "us-east-1"
  #   encrypt        = true
  #   dynamodb_table = "terraform-locks"
  # }
}

provider "aws" {
  region = var.aws_region

  default_tags {
    tags = var.tags
  }
}

# ============================================================================
# SECURITY GROUPS
# ============================================================================

resource "aws_security_group" "agents" {
  name        = "${var.project_name}-agents-sg"
  description = "Security group for agent servers"
  vpc_id      = var.vpc_id

  ingress {
    from_port   = 443
    to_port     = 443
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
  }

  ingress {
    from_port   = 80
    to_port     = 80
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
  }

  ingress {
    from_port   = 3000
    to_port     = 3000
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
  }

  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }

  tags = {
    Name = "${var.project_name}-agents-sg"
  }
}

resource "aws_security_group" "rds" {
  name        = "${var.project_name}-rds-sg"
  description = "Security group for RDS database"
  vpc_id      = var.vpc_id

  ingress {
    from_port       = 5432
    to_port         = 5432
    protocol        = "tcp"
    security_groups = [aws_security_group.agents.id]
  }

  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }

  tags = {
    Name = "${var.project_name}-rds-sg"
  }
}

# ============================================================================
# IAM ROLES & POLICIES
# ============================================================================

resource "aws_iam_role" "agent_role" {
  name = "${var.project_name}-agent-role"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Action = "sts:AssumeRole"
        Effect = "Allow"
        Principal = {
          Service = "ec2.amazonaws.com"
        }
      }
    ]
  })

  tags = {
    Name = "${var.project_name}-agent-role"
  }
}

resource "aws_iam_role_policy" "agent_policy" {
  name = "${var.project_name}-agent-policy"
  role = aws_iam_role.agent_role.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Action = [
          "secretsmanager:GetSecretValue",
          "ssm:GetParameter",
          "ssm:GetParameters"
        ]
        Resource = "*"
      },
      {
        Effect = "Allow"
        Action = [
          "logs:CreateLogGroup",
          "logs:CreateLogStream",
          "logs:PutLogEvents"
        ]
        Resource = "arn:aws:logs:*:*:*"
      },
      {
        Effect = "Allow"
        Action = [
          "cloudwatch:PutMetricData"
        ]
        Resource = "*"
      }
    ]
  })
}

resource "aws_iam_instance_profile" "agent_profile" {
  name = "${var.project_name}-agent-profile"
  role = aws_iam_role.agent_role.name
}

# ============================================================================
# RDS DATABASE
# ============================================================================

resource "aws_db_subnet_group" "main" {
  name       = "${var.project_name}-db-subnet-group"
  subnet_ids = var.subnet_ids

  tags = {
    Name = "${var.project_name}-db-subnet-group"
  }
}

resource "aws_rds_cluster" "main" {
  cluster_identifier      = "${var.project_name}-cluster"
  engine                  = "aurora-postgresql"
  engine_version          = "15.3"
  database_name           = var.db_name
  master_username         = "postgres"
  master_password         = random_password.db_password.result
  db_subnet_group_name    = aws_db_subnet_group.main.name
  vpc_security_group_ids  = [aws_security_group.rds.id]
  skip_final_snapshot     = false
  final_snapshot_identifier_prefix = "${var.project_name}-final-snapshot"
  backup_retention_period = 7
  preferred_backup_window = "03:00-04:00"
  preferred_maintenance_window = "sun:04:00-sun:05:00"
  storage_encrypted       = true

  tags = {
    Name = "${var.project_name}-cluster"
  }
}

resource "aws_rds_cluster_instance" "main" {
  count              = 1
  cluster_identifier = aws_rds_cluster.main.id
  instance_class     = var.db_instance_class
  engine              = aws_rds_cluster.main.engine
  engine_version      = aws_rds_cluster.main.engine_version
  publicly_accessible = false

  tags = {
    Name = "${var.project_name}-db-instance-${count.index + 1}"
  }
}

resource "random_password" "db_password" {
  length  = 32
  special = true
}

# ============================================================================
# EC2 INSTANCES FOR AGENTS
# ============================================================================

resource "aws_instance" "social_media_agent" {
  ami                    = data.aws_ami.amazon_linux.id
  instance_type          = var.instance_type
  subnet_id              = var.subnet_ids[0]
  vpc_security_group_ids = [aws_security_group.agents.id]
  iam_instance_profile   = aws_iam_instance_profile.agent_profile.name

  user_data = base64encode(templatefile("${path.module}/user_data_social_agent.sh", {
    db_endpoint = aws_rds_cluster.main.endpoint
    db_name     = var.db_name
    project_name = var.project_name
  }))

  tags = {
    Name = "${var.project_name}-social-media-agent"
    Role = "social-media-agent"
  }

  depends_on = [aws_rds_cluster_instance.main]
}

resource "aws_instance" "concierge_agent" {
  ami                    = data.aws_ami.amazon_linux.id
  instance_type          = var.instance_type
  subnet_id              = var.subnet_ids[0]
  vpc_security_group_ids = [aws_security_group.agents.id]
  iam_instance_profile   = aws_iam_instance_profile.agent_profile.name

  user_data = base64encode(templatefile("${path.module}/user_data_concierge_agent.sh", {
    db_endpoint = aws_rds_cluster.main.endpoint
    db_name     = var.db_name
    project_name = var.project_name
  }))

  tags = {
    Name = "${var.project_name}-concierge-agent"
    Role = "concierge-agent"
  }

  depends_on = [aws_rds_cluster_instance.main]
}

# ============================================================================
# DATA SOURCE - AMI
# ============================================================================

data "aws_ami" "amazon_linux" {
  most_recent = true
  owners      = ["amazon"]

  filter {
    name   = "name"
    values = ["amzn2-ami-hvm-*-x86_64-gp2"]
  }

  filter {
    name   = "virtualization-type"
    values = ["hvm"]
  }
}

# ============================================================================
# API GATEWAY (PLACEHOLDER)
# ============================================================================

resource "aws_apigatewayv2_api" "agents_api" {
  name          = "${var.project_name}-api"
  protocol_type = "HTTP"

  cors_configuration {
    allow_origins = ["*"]
    allow_methods = ["GET", "POST", "PUT", "DELETE", "OPTIONS"]
    allow_headers = ["*"]
  }

  tags = {
    Name = "${var.project_name}-api"
  }
}

resource "aws_apigatewayv2_stage" "prod" {
  api_id      = aws_apigatewayv2_api.agents_api.id
  name        = "prod"
  auto_deploy = true

  default_route_settings {
    logging_level            = "INFO"
    data_trace_enabled       = false
    throttle_burst_limit     = 100
    throttle_rate_limit      = 50
  }

  tags = {
    Name = "${var.project_name}-prod-stage"
  }
}
