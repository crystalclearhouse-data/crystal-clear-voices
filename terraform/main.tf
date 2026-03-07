terraform {
  required_version = ">= 1.5"
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
    random = {
      source  = "hashicorp/random"
      version = "~> 3.6"
    }
  }

  # Remote state with locking.
  # One-time bootstrap (run manually before terraform init):
  #   aws s3api create-bucket --bucket crystal-clear-voices-tf-state --region us-east-1
  #   aws s3api put-bucket-versioning --bucket crystal-clear-voices-tf-state \
  #     --versioning-configuration Status=Enabled
  #   aws s3api put-bucket-encryption --bucket crystal-clear-voices-tf-state \
  #     --server-side-encryption-configuration \
  #     '{"Rules":[{"ApplyServerSideEncryptionByDefault":{"SSEAlgorithm":"AES256"}}]}'
  #   aws dynamodb create-table --table-name terraform-locks \
  #     --attribute-definitions AttributeName=LockID,AttributeType=S \
  #     --key-schema AttributeName=LockID,KeyType=HASH \
  #     --billing-mode PAY_PER_REQUEST --region us-east-1
  backend "s3" {
    bucket         = "crystal-clear-voices-tf-state"
    key            = "prod/terraform.tfstate"
    region         = "us-east-1"
    encrypt        = true
    dynamodb_table = "terraform-locks"
  }
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
    description = "HTTPS public"
    from_port   = 443
    to_port     = 443
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
  }

  ingress {
    description = "HTTP — redirect to HTTPS only"
    from_port   = 80
    to_port     = 80
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
  }

  # Port 3000 removed — api-server is reached only via API Gateway / ALB,
  # never directly from the internet.

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
        # Least-privilege: only secrets and SSM params namespaced to this project
        Effect = "Allow"
        Action = [
          "secretsmanager:GetSecretValue",
          "ssm:GetParameter",
          "ssm:GetParameters"
        ]
        Resource = [
          "arn:aws:secretsmanager:${var.aws_region}:*:secret:${var.project_name}/*",
          "arn:aws:ssm:${var.aws_region}:*:parameter/${var.project_name}/*"
        ]
      },
      {
        Effect = "Allow"
        Action = [
          "logs:CreateLogGroup",
          "logs:CreateLogStream",
          "logs:PutLogEvents"
        ]
        Resource = "arn:aws:logs:${var.aws_region}:*:log-group:/aws/ec2/${var.project_name}*"
      },
      {
        Effect = "Allow"
        Action = [
          "cloudwatch:PutMetricData"
        ]
        # PutMetricData does not support resource-level restrictions
        Resource = "*"
        Condition = {
          StringEquals = {
            "cloudwatch:namespace" = var.project_name
          }
        }
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
  final_snapshot_identifier = "${var.project_name}-final-snapshot"
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
    # Restrict to owned domains; never use * in production
    allow_origins  = var.cors_allow_origins
    allow_methods  = ["GET", "POST", "PATCH", "OPTIONS"]
    allow_headers  = ["Content-Type", "X-API-Key", "Authorization"]
    expose_headers = ["X-Sophie-Text"]
    max_age        = 300
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
    throttling_burst_limit   = 100
    throttling_rate_limit    = 50
  }

  tags = {
    Name = "${var.project_name}-prod-stage"
  }
}

# ============================================================================
# GITHUB ACTIONS OIDC — keyless CI/CD (no long-lived AWS keys in secrets)
# ============================================================================
# How it works:
#   1. GitHub mints a short-lived OIDC JWT for every workflow run.
#   2. The JWT is presented to AWS STS AssumeRoleWithWebIdentity.
#   3. AWS validates the JWT signature against GitHub's OIDC public keys.
#   4. If the sub claim matches the trust policy, STS returns a temp role token.
#   5. configure-aws-credentials@v4 uses role-to-assume — no keys stored.
#
# Once applied, remove AWS_ACCESS_KEY_ID + AWS_SECRET_ACCESS_KEY from GitHub
# secrets and replace with AWS_DEPLOY_ROLE_ARN = the output of this module.
# ============================================================================

data "tls_certificate" "github_oidc" {
  url = "https://token.actions.githubusercontent.com/.well-known/openid-configuration"
}

resource "aws_iam_openid_connect_provider" "github_actions" {
  url             = "https://token.actions.githubusercontent.com"
  client_id_list  = ["sts.amazonaws.com"]
  thumbprint_list = [data.tls_certificate.github_oidc.certificates[0].sha1_fingerprint]

  tags = {
    Name = "${var.project_name}-github-oidc-provider"
  }
}

resource "aws_iam_role" "github_actions_deploy" {
  name = "${var.project_name}-github-actions-deploy"
  description = "Assumed by GitHub Actions OIDC — tag-triggered deploys only"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect    = "Allow"
        Principal = { Federated = aws_iam_openid_connect_provider.github_actions.arn }
        Action    = "sts:AssumeRoleWithWebIdentity"
        Condition = {
          StringEquals = {
            "token.actions.githubusercontent.com:aud" = "sts.amazonaws.com"
          }
          StringLike = {
            # Restrict to tag pushes on this repo only.
            # Format: repo:<owner>/<repo>:ref:refs/tags/*
            "token.actions.githubusercontent.com:sub" = "repo:${var.github_repo}:ref:refs/tags/*"
          }
        }
      }
    ]
  })

  tags = {
    Name = "${var.project_name}-github-actions-deploy-role"
  }
}

resource "aws_iam_role_policy" "github_actions_deploy_policy" {
  name = "${var.project_name}-github-actions-deploy-policy"
  role = aws_iam_role.github_actions_deploy.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Sid    = "ECRAuth"
        Effect = "Allow"
        Action = "ecr:GetAuthorizationToken"
        Resource = "*"
      },
      {
        Sid    = "ECRPush"
        Effect = "Allow"
        Action = [
          "ecr:BatchCheckLayerAvailability",
          "ecr:CompleteLayerUpload",
          "ecr:InitiateLayerUpload",
          "ecr:PutImage",
          "ecr:UploadLayerPart",
          "ecr:BatchGetImage",
          "ecr:GetDownloadUrlForLayer"
        ]
        # Scoped to this project's ECR repos only
        Resource = "arn:aws:ecr:${var.aws_region}:*:repository/crystal-clear-*"
      },
      {
        Sid    = "SSMDeploy"
        Effect = "Allow"
        Action = [
          "ssm:SendCommand",
          "ssm:GetCommandInvocation",
          "ssm:ListCommandInvocations"
        ]
        Resource = [
          "arn:aws:ssm:${var.aws_region}:*:document/AWS-RunShellScript",
          "arn:aws:ec2:${var.aws_region}:*:instance/*"
        ]
        Condition = {
          StringLike = {
            "ssm:resourceTag/Name" = "crystal-clear-voices*"
          }
        }
      },
      {
        Sid    = "TerraformState"
        Effect = "Allow"
        Action = [
          "s3:GetObject", "s3:PutObject", "s3:DeleteObject", "s3:ListBucket"
        ]
        Resource = [
          "arn:aws:s3:::crystal-clear-voices-tf-state",
          "arn:aws:s3:::crystal-clear-voices-tf-state/*"
        ]
      },
      {
        Sid    = "TerraformLock"
        Effect = "Allow"
        Action = [
          "dynamodb:GetItem", "dynamodb:PutItem",
          "dynamodb:DeleteItem", "dynamodb:DescribeTable"
        ]
        Resource = "arn:aws:dynamodb:${var.aws_region}:*:table/terraform-locks"
      }
    ]
  })
}

output "github_actions_deploy_role_arn" {
  description = "Add this as AWS_DEPLOY_ROLE_ARN in GitHub repository secrets."
  value       = aws_iam_role.github_actions_deploy.arn
}
