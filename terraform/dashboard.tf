# The stack's auto-provisioned Prometheus/Loki data sources follow this
# naming pattern rather than data.grafana_cloud_stack.this.prometheus_name/
# logs_name, which don't match what's actually registered (confirmed via
# Connections > Data sources on the Grafana instance).
data "grafana_data_source" "prometheus" {
  name = "grafanacloud-${local.grafana_cloud_stack_slug}-prom"
}

data "grafana_data_source" "loki" {
  name = "grafanacloud-${local.grafana_cloud_stack_slug}-logs"
}

resource "grafana_dashboard" "cloudflared" {
  config_json = replace(
    replace(
      file("${path.module}/dashboards/cloudflared.json"),
      "$${DS_PROMETHEUS}", data.grafana_data_source.prometheus.uid
    ),
    "$${DS_LOKI}", data.grafana_data_source.loki.uid
  )
  folder    = grafana_folder.cloudflared.uid
  overwrite = true
}

resource "grafana_dashboard" "node_exporter" {
  config_json = replace(
    replace(
      file("${path.module}/dashboards/node-exporter.json"),
      "$${DS_PROMETHEUS}", data.grafana_data_source.prometheus.uid
    ),
    "$${DS_LOKI}", data.grafana_data_source.loki.uid
  )
  folder    = grafana_folder.cloudflared.uid
  overwrite = true
}

resource "grafana_dashboard" "kubernetes" {
  config_json = replace(
    replace(
      file("${path.module}/dashboards/kubernetes.json"),
      "$${DS_PROMETHEUS}", data.grafana_data_source.prometheus.uid
    ),
    "$${DS_LOKI}", data.grafana_data_source.loki.uid
  )
  folder    = grafana_folder.cloudflared.uid
  overwrite = true
}

resource "grafana_dashboard" "postgres" {
  config_json = replace(
    replace(
      file("${path.module}/dashboards/postgres.json"),
      "$${DS_PROMETHEUS}", data.grafana_data_source.prometheus.uid
    ),
    "$${DS_LOKI}", data.grafana_data_source.loki.uid
  )
  folder    = grafana_folder.cloudflared.uid
  overwrite = true
}

resource "grafana_dashboard" "traefik" {
  config_json = replace(
    replace(
      file("${path.module}/dashboards/traefik.json"),
      "$${DS_PROMETHEUS}", data.grafana_data_source.prometheus.uid
    ),
    "$${DS_LOKI}", data.grafana_data_source.loki.uid
  )
  folder    = grafana_folder.cloudflared.uid
  overwrite = true
}

resource "grafana_dashboard" "app" {
  config_json = replace(
    file("${path.module}/dashboards/app.json"),
    "$${DS_PROMETHEUS}", data.grafana_data_source.prometheus.uid
  )
  folder    = grafana_folder.cloudflared.uid
  overwrite = true
}
