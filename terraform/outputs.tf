output "rds_cluster_endpoint" {
  description = "RDS cluster endpoint"
  value       = aws_rds_cluster.main.endpoint
}

output "rds_reader_endpoint" {
  description = "RDS cluster reader endpoint"
  value       = aws_rds_cluster.main.reader_endpoint
}

output "social_media_agent_id" {
  description = "EC2 instance ID for social media agent"
  value       = aws_instance.social_media_agent.id
}

output "social_media_agent_private_ip" {
  description = "Private IP of social media agent"
  value       = aws_instance.social_media_agent.private_ip
}

output "social_media_agent_public_ip" {
  description = "Public IP of social media agent"
  value       = aws_instance.social_media_agent.public_ip
}

output "concierge_agent_id" {
  description = "EC2 instance ID for concierge agent"
  value       = aws_instance.concierge_agent.id
}

output "concierge_agent_private_ip" {
  description = "Private IP of concierge agent"
  value       = aws_instance.concierge_agent.private_ip
}

output "concierge_agent_public_ip" {
  description = "Public IP of concierge agent"
  value       = aws_instance.concierge_agent.public_ip
}

output "api_gateway_endpoint" {
  description = "API Gateway endpoint URL"
  value       = aws_apigatewayv2_api.agents_api.api_endpoint
}

output "api_gateway_invoke_url" {
  description = "API Gateway invoke URL"
  value       = aws_apigatewayv2_stage.prod.invoke_url
}

output "db_password_secret" {
  description = "Database master password (store this securely)"
  value       = random_password.db_password.result
  sensitive   = true
}
