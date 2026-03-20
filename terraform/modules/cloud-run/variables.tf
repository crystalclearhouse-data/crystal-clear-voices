variable "project_id" {
  description = "GCP project ID"
  type        = string
}

variable "region" {
  description = "GCP region for the Cloud Run service"
  type        = string
  default     = "us-central1"
}

variable "service_name" {
  description = "Name of the Cloud Run service (must be unique within the project/region)"
  type        = string
}

variable "image" {
  description = "Container image URI (e.g. gcr.io/my-project/my-service:latest)"
  type        = string
}

variable "container_port" {
  description = "Port the container listens on"
  type        = number
  default     = 8080
}

variable "cpu" {
  description = "CPU limit for the container (e.g. '1' or '2')"
  type        = string
  default     = "1"
}

variable "memory" {
  description = "Memory limit for the container (e.g. '512Mi' or '1Gi')"
  type        = string
  default     = "512Mi"
}

variable "min_instances" {
  description = "Minimum number of container instances (0 allows scale-to-zero)"
  type        = number
  default     = 0
}

variable "max_instances" {
  description = "Maximum number of container instances"
  type        = number
  default     = 10
}

variable "startup_cpu_boost" {
  description = "Allocate extra CPU during startup to reduce cold-start latency"
  type        = bool
  default     = true
}

variable "ingress" {
  description = "Ingress setting: INGRESS_TRAFFIC_ALL, INGRESS_TRAFFIC_INTERNAL_ONLY, or INGRESS_TRAFFIC_INTERNAL_LOAD_BALANCER"
  type        = string
  default     = "INGRESS_TRAFFIC_ALL"

  validation {
    condition     = contains(["INGRESS_TRAFFIC_ALL", "INGRESS_TRAFFIC_INTERNAL_ONLY", "INGRESS_TRAFFIC_INTERNAL_LOAD_BALANCER"], var.ingress)
    error_message = "ingress must be one of: INGRESS_TRAFFIC_ALL, INGRESS_TRAFFIC_INTERNAL_ONLY, INGRESS_TRAFFIC_INTERNAL_LOAD_BALANCER"
  }
}

variable "allow_unauthenticated" {
  description = "Whether to allow unauthenticated (public) access to the service"
  type        = bool
  default     = false
}

variable "env_vars" {
  description = "Plain-text environment variables to pass to the container"
  type        = map(string)
  default     = {}
}

variable "secret_env_vars" {
  description = "Environment variables sourced from Secret Manager. Map of env-var-name → {secret, version}."
  type = map(object({
    secret  = string
    version = string
  }))
  default = {}
}

variable "health_check_path" {
  description = "HTTP path for startup/liveness probes and uptime checks"
  type        = string
  default     = "/health"
}

variable "health_check_response_contains" {
  description = "String that the health-check response must contain (used by the uptime monitor)"
  type        = string
  default     = "healthy"
}

variable "enable_uptime_check" {
  description = "Create a Cloud Monitoring uptime check for the service URL"
  type        = bool
  default     = true
}

variable "labels" {
  description = "Labels to apply to the Cloud Run service and its instances"
  type        = map(string)
  default     = {}
}
