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

output "concierge_agent_id" {
  description = "EC2 instance ID for concierge agent"
  value       = aws_instance.concierge_agent.id
}

output "concierge_agent_private_ip" {
  description = "Private IP of concierge agent"
  value       = aws_instance.concierge_agent.private_ip
}

output "api_gateway_endpoint" {
  description = "API Gateway endpoint URL"
  value       = aws_apigatewayv2_api.agents_api.api_endpoint
}

output "api_gateway_invoke_url" {
  description = "API Gateway invoke URL"
  value       = aws_apigatewayv2_stage.prod.invoke_url
}

output "db_password_secret_arn" {
  description = "ARN of the Secrets Manager secret holding the database master password"
  value       = aws_secretsmanager_secret.db_password.arn
}

output "twilio_voice_webhook_url" {
  description = "Twilio voice webhook URL — paste into Twilio console → Phone Numbers → Voice"
  value       = "${var.public_url}/twilio/voice"
}

output "twilio_sms_webhook_url" {
  description = "Twilio SMS webhook URL — paste into Twilio console → Phone Numbers → Messaging"
  value       = "${var.public_url}/twilio/sms"
}

output "public_url" {
  description = "Canonical public base URL for this environment"
  value       = var.public_url
}
