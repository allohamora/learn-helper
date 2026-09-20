variable "grafana_url" {
  type = string
}

variable "grafana_auth" {
  type      = string
  sensitive = true
}

variable "grafana_cloud_access_policy_token" {
  type      = string
  sensitive = true
}

variable "alert_contact_email" {
  type = string
}
