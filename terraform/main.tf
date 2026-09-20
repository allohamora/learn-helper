terraform {
  required_providers {
    grafana = {
      source  = "grafana/grafana"
      version = "~> 4.46.0"
    }
  }
}

provider "grafana" {
  url                       = var.grafana_url
  auth                      = var.grafana_auth
  cloud_access_policy_token = var.grafana_cloud_access_policy_token
}
