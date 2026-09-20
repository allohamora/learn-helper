resource "grafana_folder" "cloudflared" {
  title = "learn-helper"
}

# Rule conditions use PromQL's `bool` modifier so the query always returns a
# concrete 0/1 per series instead of filtering series out (or returning the
# raw metric value, which can itself legitimately be 0 - e.g. a full outage -
# and would otherwise be mistaken by Grafana's "non-zero fires" rule for "not
# firing"). A truly absent metric (server powered off) still returns no
# series at all even with `bool`, so no_data_state = "OK" preserves the
# original Prometheus-rule-file behavior of never alerting on missing data.
resource "grafana_rule_group" "cloudflared" {
  name             = "cloudflared"
  folder_uid       = grafana_folder.cloudflared.uid
  interval_seconds = 60

  rule {
    name          = "CloudflaredHAConnectionsDegraded"
    condition     = "A"
    for           = "5m"
    is_paused     = false
    no_data_state = "OK"

    data {
      ref_id         = "A"
      datasource_uid = data.grafana_data_source.prometheus.uid

      relative_time_range {
        from = 600
        to   = 0
      }

      model = jsonencode({
        refId      = "A"
        instant    = true
        range      = false
        datasource = { type = "prometheus", uid = data.grafana_data_source.prometheus.uid }
        expr       = "max(cloudflared_tunnel_ha_connections{deployment_environment_name=\"production\"}) < bool 4"
      })
    }

    labels = {
      alert_group = "cloudflared"
      severity    = "critical"
    }

    annotations = {
      summary     = "cloudflared has fewer than 4 HA connections to Cloudflare's edge"
      description = <<-EOT
        Covers everything from partial degradation down to a full outage (0
        connections), as long as the metric is actually arriving. Deliberately
        does NOT fire on missing data - the server is expected to be powered off
        sometimes, and that shouldn't page anyone. The tradeoff: if cloudflared or
        Alloy silently dies while the server keeps running, this alert won't catch
        it either, since that also looks like "no data" from here. Scoped to the
        production environment so a devcontainer test run (ENVIRONMENT: development)
        can't page anyone.
      EOT
    }
  }

  rule {
    name          = "CloudflaredOriginErrors"
    condition     = "A"
    for           = "5m"
    is_paused     = false
    no_data_state = "OK"

    data {
      ref_id         = "A"
      datasource_uid = data.grafana_data_source.prometheus.uid

      relative_time_range {
        from = 600
        to   = 0
      }

      model = jsonencode({
        refId      = "A"
        instant    = true
        range      = false
        datasource = { type = "prometheus", uid = data.grafana_data_source.prometheus.uid }
        expr       = <<-EOT
          (
            sum(rate(cloudflared_tunnel_request_errors{deployment_environment_name="production"}[5m]))
            /
            sum(rate(cloudflared_tunnel_total_requests{deployment_environment_name="production"}[5m]))
          ) > bool 0.05
        EOT
      })
    }

    labels = {
      alert_group = "cloudflared"
      severity    = "warning"
    }

    annotations = {
      summary     = "cloudflared is failing to proxy requests to the app's origin"
      description = <<-EOT
        Origin-connection failures (never produce a status code) as a share of all
        requests attempted, distinct from the app's own HTTP error responses. A
        ratio instead of a raw rate so the threshold doesn't need retuning as
        traffic grows or shrinks. 5% is a starting point - tune after watching real
        traffic. Scoped to the production environment so a devcontainer test run
        (ENVIRONMENT: development) can't page anyone.
      EOT
    }
  }

  rule {
    name          = "CloudflaredTunnelFlapping"
    condition     = "A"
    for           = "15m"
    is_paused     = false
    no_data_state = "OK"

    data {
      ref_id         = "A"
      datasource_uid = data.grafana_data_source.prometheus.uid

      relative_time_range {
        from = 2400
        to   = 0
      }

      model = jsonencode({
        refId      = "A"
        instant    = true
        range      = false
        datasource = { type = "prometheus", uid = data.grafana_data_source.prometheus.uid }
        expr       = "increase(cloudflared_tunnel_tunnel_register_success{deployment_environment_name=\"production\"}[30m]) > bool 12"
      })
    }

    labels = {
      alert_group = "cloudflared"
      severity    = "warning"
    }

    annotations = {
      summary     = "cloudflared is repeatedly re-registering with Cloudflare's edge"
      description = <<-EOT
        cloudflared registers each of its 4 HA connections separately, so a single
        pod restart/deploy produces a one-time burst of ~4 registrations that's
        normal, not a problem - the 12 threshold is what keeps that from firing, not
        the "for" duration (a burst that did cross 12 would stay in the 30m window,
        and therefore stay true, for close to 30 minutes, well past 15m). This only
        fires on registration churn that keeps recurring well past what a single
        restart explains. There's no established baseline for this tunnel yet (one
        observation: 8 registrations in ~64m of normal operation), so 12 is a rough
        starting point, not a validated threshold - watch the Tunnel Registrations
        dashboard panel and adjust once you know what's actually normal. Scoped to
        the production environment so a devcontainer test run
        (ENVIRONMENT: development) can't page anyone.
      EOT
    }
  }

  rule {
    name          = "CloudflaredErrorLogsElevated"
    condition     = "A"
    for           = "5m"
    is_paused     = false
    no_data_state = "OK"

    data {
      ref_id         = "A"
      datasource_uid = data.grafana_data_source.loki.uid

      relative_time_range {
        from = 600
        to   = 0
      }

      model = jsonencode({
        refId      = "A"
        instant    = true
        range      = false
        datasource = { type = "loki", uid = data.grafana_data_source.loki.uid }
        expr       = "sum(count_over_time({service_name=\"cloudflared\", deployment_environment_name=\"production\"} | detected_level=~\"error|fatal\" [5m])) > bool 5"
      })
    }

    labels = {
      alert_group = "cloudflared"
      severity    = "warning"
    }

    annotations = {
      summary     = "cloudflared is logging errors persistently"
      description = <<-EOT
        Counts cloudflared's own error/fatal-level log lines (detected_level, derived
        by Alloy from the zerolog "level" field of cloudflared's JSON output), which
        catches internal failures - auth, config reload, DNS - that don't necessarily
        show up in the Prometheus metrics covered by the other rules here. More than
        5 lines in a 5m window, sustained for 5m, so a single transient error doesn't
        page anyone. No established baseline yet - adjust once you know what's normal.
        Scoped to the production environment so a devcontainer test run
        (ENVIRONMENT: development) can't page anyone.
      EOT
    }
  }

  rule {
    name          = "CloudflaredFatalLog"
    condition     = "A"
    for           = "1m"
    is_paused     = false
    no_data_state = "OK"

    data {
      ref_id         = "A"
      datasource_uid = data.grafana_data_source.loki.uid

      relative_time_range {
        from = 120
        to   = 0
      }

      model = jsonencode({
        refId      = "A"
        instant    = true
        range      = false
        datasource = { type = "loki", uid = data.grafana_data_source.loki.uid }
        expr       = "sum(count_over_time({service_name=\"cloudflared\", deployment_environment_name=\"production\"} | detected_level=\"fatal\" [1m])) > bool 0"
      })
    }

    labels = {
      alert_group = "cloudflared"
      severity    = "critical"
    }

    annotations = {
      summary     = "cloudflared logged a fatal error and is likely restarting"
      description = <<-EOT
        zerolog's Fatal level calls os.Exit(1), so even a single occurrence means the
        process just crashed - no volume threshold, unlike the error-rate rule above.
        Scoped to the production environment so a devcontainer test run
        (ENVIRONMENT: development) can't page anyone.
      EOT
    }
  }
}

resource "grafana_contact_point" "cloudflared" {
  name = "learn-helper-contact-point"

  email {
    addresses = [var.alert_contact_email]
  }

  lifecycle {
    create_before_destroy = true
  }
}

resource "grafana_notification_policy" "default" {
  contact_point = grafana_contact_point.cloudflared.name
  group_by      = ["..."]

  policy {
    contact_point = grafana_contact_point.cloudflared.name

    matcher {
      label = "alert_group"
      match = "="
      value = "cloudflared"
    }
  }
}
