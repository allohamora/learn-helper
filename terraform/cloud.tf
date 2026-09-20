locals {
  # Derived from grafana_url (e.g. "https://yourorg.grafana.net") instead of
  # a separate variable - the stack slug is just its subdomain.
  grafana_cloud_stack_slug = regex("^https://([^.]+)\\.grafana\\.net/?$", var.grafana_url)[0]
}

data "grafana_cloud_stack" "this" {
  slug = local.grafana_cloud_stack_slug
}

resource "grafana_cloud_access_policy" "otlp" {
  region       = data.grafana_cloud_stack.this.region_slug
  name         = "learn-helper-otlp"
  display_name = "learn-helper OTLP ingestion"
  scopes       = ["metrics:write", "logs:write"]

  realm {
    type       = "stack"
    identifier = tostring(data.grafana_cloud_stack.this.id)
  }
}

resource "grafana_cloud_access_policy_token" "otlp" {
  region           = data.grafana_cloud_stack.this.region_slug
  access_policy_id = grafana_cloud_access_policy.otlp.policy_id
  name             = "learn-helper-otlp"
}

# The OTLP gateway's basic-auth username ("instance ID") is assumed to be the
# stack's own numeric id - this matches what Grafana Cloud's Connections >
# OpenTelemetry (OTLP) > "View connection details" page shows, but isn't
# documented as a named attribute anywhere in the provider docs. Verify the
# decoded value from `terraform output -raw otel_exporter_otlp_headers` matches
# "<that page's Instance ID>:<token>" before trusting it.
#
# This has to be a Terraform output, unlike the endpoint (fetched via
# `terraform console` in the README) - the access policy token is marked
# sensitive by the provider, and `terraform console` has no way to unmask a
# sensitive value. Naming a sensitive output explicitly via `terraform output`
# is the one place Terraform allows revealing it on demand.
output "otel_exporter_otlp_headers" {
  value     = base64encode("${data.grafana_cloud_stack.this.id}:${grafana_cloud_access_policy_token.otlp.token}")
  sensitive = true
}
