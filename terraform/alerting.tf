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

# bool is placed only on the outer threshold comparison in each rule below, never
# on a filter clause inside an `and on(...)` join - Prometheus's `bool` modifier
# makes a comparison return 0/1 for every series instead of dropping non-matches,
# so putting it on a join filter would stop that filter from excluding anything.
resource "grafana_rule_group" "node_exporter" {
  name             = "node-exporter"
  folder_uid       = grafana_folder.cloudflared.uid
  interval_seconds = 60

  rule {
    name          = "HostOutOfMemory"
    condition     = "A"
    for           = "2m"
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
        expr       = "node_memory_MemAvailable_bytes{deployment_environment_name=\"production\"} / node_memory_MemTotal_bytes{deployment_environment_name=\"production\"} < bool 0.10"
      })
    }

    labels = {
      alert_group = "node-exporter"
      severity    = "warning"
    }

    annotations = {
      summary     = "Host has less than 10% memory available"
      description = <<-EOT
        Available memory (not just "free" - includes reclaimable cache/buffers) as a
        share of total, so the threshold doesn't need retuning if the host's memory
        size changes. Deliberately does NOT fire on missing data - the server is
        expected to be powered off sometimes, and that shouldn't page anyone. Scoped
        to the production environment so a devcontainer test run
        (ENVIRONMENT: development) can't page anyone.
      EOT
    }
  }

  rule {
    name          = "HostHighCpuLoad"
    condition     = "A"
    for           = "10m"
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
        expr       = "(1 - avg without (cpu, mode) (rate(node_cpu_seconds_total{mode=\"idle\", deployment_environment_name=\"production\"}[5m]))) > bool 0.80"
      })
    }

    labels = {
      alert_group = "node-exporter"
      severity    = "warning"
    }

    annotations = {
      summary     = "Host CPU is over 80% busy"
      description = <<-EOT
        Averaged across all cores over a 5m window, so a brief single-core spike
        doesn't trip this - only sustained, host-wide load does. 80% is a starting
        point, not a validated threshold - adjust once you know what's normal for
        this host's workload. Deliberately does NOT fire on missing data. Scoped to
        the production environment so a devcontainer test run
        (ENVIRONMENT: development) can't page anyone.
      EOT
    }
  }

  rule {
    name          = "HostOutOfDiskSpace"
    condition     = "A"
    for           = "2m"
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
            node_filesystem_avail_bytes{fstype!~"tmpfs|overlay", deployment_environment_name="production"}
            /
            node_filesystem_size_bytes{fstype!~"tmpfs|overlay", deployment_environment_name="production"}
            < bool 0.10
          )
          and on(instance, device, mountpoint) (
            node_filesystem_readonly{deployment_environment_name="production"} == 0
          )
        EOT
      })
    }

    labels = {
      alert_group = "node-exporter"
      severity    = "critical"
    }

    annotations = {
      summary     = "Host filesystem has less than 10% space free"
      description = <<-EOT
        Excludes tmpfs/overlay (ephemeral, not worth alerting on) and read-only
        mounts (can't be written to further, so a full one isn't actionable the same
        way). Deliberately does NOT fire on missing data - the server is expected to
        be powered off sometimes, and that shouldn't page anyone. Scoped to the
        production environment so a devcontainer test run
        (ENVIRONMENT: development) can't page anyone.
      EOT
    }
  }

  rule {
    name          = "HostOutOfInodes"
    condition     = "A"
    for           = "2m"
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
            node_filesystem_files_free{deployment_environment_name="production"}
            /
            node_filesystem_files{deployment_environment_name="production"}
            < bool 0.10
          )
          and on(instance, device, mountpoint) (
            node_filesystem_readonly{deployment_environment_name="production"} == 0
          )
        EOT
      })
    }

    labels = {
      alert_group = "node-exporter"
      severity    = "critical"
    }

    annotations = {
      summary     = "Host filesystem has less than 10% inodes free"
      description = <<-EOT
        A filesystem can run out of inodes (the metadata slots that track files/
        directories) well before it runs out of disk space, if the workload creates
        lots of small files - this catches that failure mode, which the disk-space
        rule above would miss entirely. Deliberately does NOT fire on missing data.
        Scoped to the production environment so a devcontainer test run
        (ENVIRONMENT: development) can't page anyone.
      EOT
    }
  }

  rule {
    name          = "HostDiskMayFillIn24Hours"
    condition     = "A"
    for           = "2m"
    is_paused     = false
    no_data_state = "OK"

    data {
      ref_id         = "A"
      datasource_uid = data.grafana_data_source.prometheus.uid

      relative_time_range {
        from = 21600
        to   = 0
      }

      model = jsonencode({
        refId      = "A"
        instant    = true
        range      = false
        datasource = { type = "prometheus", uid = data.grafana_data_source.prometheus.uid }
        expr       = <<-EOT
          (
            predict_linear(node_filesystem_avail_bytes{fstype!~"tmpfs|overlay", deployment_environment_name="production"}[3h], 24 * 3600)
            <= bool 0
          )
          and on(instance, device, mountpoint) (
            node_filesystem_avail_bytes{deployment_environment_name="production"} > 0
          )
          and on(instance, device, mountpoint) (
            node_filesystem_readonly{deployment_environment_name="production"} == 0
          )
        EOT
      })
    }

    labels = {
      alert_group = "node-exporter"
      severity    = "warning"
    }

    annotations = {
      summary     = "Host filesystem is trending toward full within 24 hours"
      description = <<-EOT
        Fits a trend line to the last 3h of free-space samples and projects it 24h
        forward - fires before HostOutOfDiskSpace's hard 10% threshold is hit, while
        there's still time to act. A filesystem that's already essentially full
        (avail_bytes near 0) is excluded here since HostOutOfDiskSpace already covers
        it. Deliberately does NOT fire on missing data. Scoped to the production
        environment so a devcontainer test run (ENVIRONMENT: development) can't page
        anyone.
      EOT
    }
  }

  rule {
    name          = "NodeExporterDown"
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
        expr       = "up{job=\"node-exporter\", deployment_environment_name=\"production\"} == bool 0"
      })
    }

    labels = {
      alert_group = "node-exporter"
      severity    = "critical"
    }

    annotations = {
      summary     = "node-exporter isn't responding to scrapes"
      description = <<-EOT
        Alloy scraped the node-exporter target and got no response. Distinct from the
        server being powered off entirely - that case produces no "up" series at all,
        since Alloy runs on the same node and goes down with it, which
        no_data_state = "OK" already treats as fine. This only fires when Alloy itself
        is up and reachable but node-exporter specifically has crashed, is
        crash-looping, or is otherwise unresponsive. Scoped to the production
        environment so a devcontainer test run (ENVIRONMENT: development) can't page
        anyone.
      EOT
    }
  }

  rule {
    name          = "HostInodesMayFillIn24Hours"
    condition     = "A"
    for           = "2m"
    is_paused     = false
    no_data_state = "OK"

    data {
      ref_id         = "A"
      datasource_uid = data.grafana_data_source.prometheus.uid

      relative_time_range {
        from = 21600
        to   = 0
      }

      model = jsonencode({
        refId      = "A"
        instant    = true
        range      = false
        datasource = { type = "prometheus", uid = data.grafana_data_source.prometheus.uid }
        expr       = <<-EOT
          (
            predict_linear(node_filesystem_files_free{fstype!~"tmpfs|overlay", deployment_environment_name="production"}[3h], 24 * 3600)
            <= bool 0
          )
          and on(instance, device, mountpoint) (
            node_filesystem_files_free{deployment_environment_name="production"} > 0
          )
          and on(instance, device, mountpoint) (
            node_filesystem_readonly{deployment_environment_name="production"} == 0
          )
        EOT
      })
    }

    labels = {
      alert_group = "node-exporter"
      severity    = "warning"
    }

    annotations = {
      summary     = "Host filesystem is trending toward inode exhaustion within 24 hours"
      description = <<-EOT
        Same predict_linear approach as HostDiskMayFillIn24Hours, applied to free
        inodes instead of free bytes - fires before HostOutOfInodes's hard 10%
        threshold is hit, while there's still time to act. A filesystem already
        essentially out of inodes (files_free near 0) is excluded here since
        HostOutOfInodes already covers it. Deliberately does NOT fire on missing
        data. Scoped to the production environment so a devcontainer test run
        (ENVIRONMENT: development) can't page anyone.
      EOT
    }
  }

  rule {
    name          = "HostSwapIsFillingUp"
    condition     = "A"
    for           = "2m"
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
        expr       = "(1 - (node_memory_SwapFree_bytes{deployment_environment_name=\"production\"} / node_memory_SwapTotal_bytes{deployment_environment_name=\"production\"})) > bool 0.80"
      })
    }

    labels = {
      alert_group = "node-exporter"
      severity    = "warning"
    }

    annotations = {
      summary     = "Host swap is more than 80% used"
      description = <<-EOT
        On a host with no swap configured, SwapTotal_bytes is 0, making this 0/0
        (NaN) - Prometheus comparisons against NaN are always false, so this rule
        stays silent rather than firing wherever swap happens to be disabled.
        Deliberately does NOT fire on missing data. Scoped to the production
        environment so a devcontainer test run (ENVIRONMENT: development) can't
        page anyone.
      EOT
    }
  }

  rule {
    name          = "HostOomKillDetected"
    condition     = "A"
    for           = "1m"
    is_paused     = false
    no_data_state = "OK"

    data {
      ref_id         = "A"
      datasource_uid = data.grafana_data_source.prometheus.uid

      relative_time_range {
        from = 1800
        to   = 0
      }

      model = jsonencode({
        refId      = "A"
        instant    = true
        range      = false
        datasource = { type = "prometheus", uid = data.grafana_data_source.prometheus.uid }
        expr       = "increase(node_vmstat_oom_kill{deployment_environment_name=\"production\"}[15m]) > bool 0"
      })
    }

    labels = {
      alert_group = "node-exporter"
      severity    = "critical"
    }

    annotations = {
      summary     = "Kernel OOM killer has killed a process on the host"
      description = <<-EOT
        A backstop for HostOutOfMemory: that rule fires when available memory drops
        below 10% and stays there for 2m, but a sudden allocation spike can trigger
        the OOM killer before that condition is ever sustained long enough to fire.
        This catches it after the fact - by the time this fires, something has
        already been killed. Deliberately does NOT fire on missing data. Scoped to
        the production environment so a devcontainer test run
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

  policy {
    contact_point = grafana_contact_point.cloudflared.name

    matcher {
      label = "alert_group"
      match = "="
      value = "node-exporter"
    }
  }
}
