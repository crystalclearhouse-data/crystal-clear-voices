output "service_url" {
  description = "The HTTPS URL of the deployed Cloud Run service"
  value       = google_cloud_run_v2_service.service.uri
}

output "service_name" {
  description = "The fully-qualified name of the Cloud Run service"
  value       = google_cloud_run_v2_service.service.name
}

output "service_id" {
  description = "The server-assigned unique ID of the Cloud Run service"
  value       = google_cloud_run_v2_service.service.id
}

output "service_account_email" {
  description = "Email of the service account attached to the Cloud Run service"
  value       = google_service_account.service.email
}

output "latest_ready_revision" {
  description = "Name of the latest revision that is ready to serve traffic"
  value       = google_cloud_run_v2_service.service.latest_ready_revision
}

output "uptime_check_id" {
  description = "ID of the Cloud Monitoring uptime check (empty when enable_uptime_check = false)"
  value       = var.enable_uptime_check ? google_monitoring_uptime_check_config.service[0].uptime_check_id : null
}
