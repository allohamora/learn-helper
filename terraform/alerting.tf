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
        expr       = "node_memory_MemAvailable_bytes{deployment_environment_name=\"production\"} / node_memory_MemTotal_bytes{deployment_environment_name=\"production\"} < bool 0.20"
      })
    }

    labels = {
      alert_group = "node-exporter"
      severity    = "warning"
    }

    annotations = {
      summary     = "Host has less than 20% memory available"
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
            < bool 0.20
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
      summary     = "Host filesystem has less than 20% space free"
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
    name          = "HostOutOfSwap"
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
        below 20% and stays there for 2m, but a sudden allocation spike can trigger
        the OOM killer before that condition is ever sustained long enough to fire.
        This catches it after the fact - by the time this fires, something has
        already been killed. Deliberately does NOT fire on missing data. Scoped to
        the production environment so a devcontainer test run
        (ENVIRONMENT: development) can't page anyone.
      EOT
    }
  }
}

resource "grafana_rule_group" "kubernetes" {
  name             = "kubernetes"
  folder_uid       = grafana_folder.cloudflared.uid
  interval_seconds = 60

  rule {
    name          = "PodCrashLooping"
    condition     = "A"
    for           = "5m"
    is_paused     = false
    no_data_state = "OK"

    data {
      ref_id         = "A"
      datasource_uid = data.grafana_data_source.prometheus.uid

      relative_time_range {
        from = 900
        to   = 0
      }

      model = jsonencode({
        refId      = "A"
        instant    = true
        range      = false
        datasource = { type = "prometheus", uid = data.grafana_data_source.prometheus.uid }
        expr       = "sum by (namespace, pod) (increase(kube_pod_container_status_restarts_total{deployment_environment_name=\"production\"}[15m])) > bool 3"
      })
    }

    labels = {
      alert_group = "kubernetes"
      severity    = "warning"
    }

    annotations = {
      summary     = "A pod has restarted more than 3 times in 15 minutes"
      description = <<-EOT
        Counts container restarts per pod (kube-state-metrics), a proxy for crash-looping -
        distinct from node-exporter's host-level metrics, this catches an individual
        workload misbehaving even while the host itself looks healthy. 3 restarts in 15m is
        a starting point, not a validated threshold - adjust once you know what's normal.
        Deliberately does NOT fire on missing data - the server is expected to be powered
        off sometimes, and that shouldn't page anyone. Scoped to the production environment
        so a devcontainer test run (ENVIRONMENT: development) can't page anyone.
      EOT
    }
  }

  rule {
    name          = "DeploymentReplicasUnavailable"
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
        expr       = "kube_deployment_status_replicas_unavailable{deployment_environment_name=\"production\"} > bool 0"
      })
    }

    labels = {
      alert_group = "kubernetes"
      severity    = "warning"
    }

    annotations = {
      summary     = "A Deployment has unavailable replicas"
      description = <<-EOT
        Fires only once unavailable replicas stay above 0 for 5m, so a normal rolling
        update in progress doesn't page anyone - only a rollout that's actually stuck does.
        Deliberately does NOT fire on missing data. Scoped to the production environment so
        a devcontainer test run (ENVIRONMENT: development) can't page anyone.
      EOT
    }
  }

  rule {
    name          = "ContainerOomKilled"
    condition     = "A"
    for           = "1m"
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
        expr       = "sum(kube_pod_container_status_last_terminated_reason{reason=\"OOMKilled\", deployment_environment_name=\"production\"}) > bool 0"
      })
    }

    labels = {
      alert_group = "kubernetes"
      severity    = "critical"
    }

    annotations = {
      summary     = "A container's last termination reason was OOMKilled"
      description = <<-EOT
        Distinct from node-exporter's HostOomKillDetected - this is a container hitting its
        own memory limit, not the whole host running out. Unlike that rule, this reads a
        gauge (kube-state-metrics reports the pod's *current* last-terminated reason, not a
        counter of kill events), so it keeps firing until the container is recreated or the
        pod is deleted, not just at the moment of the kill. Deliberately does NOT fire on
        missing data. Scoped to the production environment so a devcontainer test run
        (ENVIRONMENT: development) can't page anyone.
      EOT
    }
  }

  rule {
    name          = "NodeNotReady"
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
        expr       = "kube_node_status_condition{condition=\"Ready\", status=\"true\", deployment_environment_name=\"production\"} == bool 0"
      })
    }

    labels = {
      alert_group = "kubernetes"
      severity    = "critical"
    }

    annotations = {
      summary     = "A node's Ready condition is not True"
      description = <<-EOT
        Kubernetes' own view of node health (kube-state-metrics), distinct from
        node-exporter's raw host metrics - this can catch a node the scheduler has given up
        on even if the host itself still looks up. Deliberately does NOT fire on missing
        data - the server is expected to be powered off sometimes, and that shouldn't page
        anyone. Scoped to the production environment so a devcontainer test run
        (ENVIRONMENT: development) can't page anyone.
      EOT
    }
  }

  rule {
    name          = "KubernetesWarningEventsElevated"
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
        expr       = "sum(count_over_time({service_name=\"kubernetes-events\", deployment_environment_name=\"production\"} | type=\"Warning\" [5m])) > bool 5"
      })
    }

    labels = {
      alert_group = "kubernetes"
      severity    = "warning"
    }

    annotations = {
      summary     = "Kubernetes is logging Warning events persistently"
      description = <<-EOT
        Counts Warning-type cluster events (FailedScheduling, BackOff, FailedMount,
        Unhealthy, ...) - the Events panel (dashboards/kubernetes.json) ships every event
        type, so this rule filters to Warning itself rather than relying on a curated
        pipeline. More than 5 in a 5m window, sustained for 5m, so a single transient event
        doesn't page anyone. No established baseline yet - adjust once you know what's
        normal. Scoped to the production environment so a devcontainer test run
        (ENVIRONMENT: development) can't page anyone.
      EOT
    }
  }
}

resource "grafana_rule_group" "postgres" {
  name             = "postgres"
  folder_uid       = grafana_folder.cloudflared.uid
  interval_seconds = 60

  rule {
    name          = "PostgresConnectionsHigh"
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
            sum(pg_stat_database_numbackends{deployment_environment_name="production"})
            /
            max(pg_settings_max_connections{deployment_environment_name="production"})
          ) > bool 0.8
        EOT
      })
    }

    labels = {
      alert_group = "postgres"
      severity    = "warning"
    }

    annotations = {
      summary     = "Postgres is using more than 80% of max_connections"
      description = <<-EOT
        Active backend connections as a share of the server's own configured
        max_connections, so the threshold self-adjusts if that setting is ever
        tuned instead of chasing a fixed guessed number. Deliberately does NOT
        fire on missing data - the server is expected to be powered off sometimes,
        and that shouldn't page anyone. Scoped to the production environment so a
        devcontainer test run (ENVIRONMENT: development) can't page anyone.
      EOT
    }
  }

  rule {
    name          = "PostgresCacheHitRatioLow"
    condition     = "A"
    for           = "15m"
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
            sum(rate(pg_stat_database_blks_hit{deployment_environment_name="production"}[10m]))
            /
            (
              sum(rate(pg_stat_database_blks_hit{deployment_environment_name="production"}[10m]))
              +
              sum(rate(pg_stat_database_blks_read{deployment_environment_name="production"}[10m]))
            )
          ) < bool 0.98
        EOT
      })
    }

    labels = {
      alert_group = "postgres"
      severity    = "warning"
    }

    annotations = {
      summary     = "Postgres cache hit ratio has dropped below 98%"
      description = <<-EOT
        Share of block reads served from shared buffers rather than disk, sustained
        for 15m. The container has only 512Mi allotted, so the working set can
        plausibly outgrow cache - a sustained drop signals rising physical I/O. With
        no query activity at all this ratio is 0/0 (NaN), and Prometheus comparisons
        against NaN are always false, so this rule stays silent rather than firing
        on an idle database - same idiom as node-exporter's HostOutOfSwap.
        Deliberately does NOT fire on missing data. Scoped to the production
        environment so a devcontainer test run (ENVIRONMENT: development) can't
        page anyone.
      EOT
    }
  }

  rule {
    name          = "PostgresSlowQueriesElevated"
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
        expr       = "sum(count_over_time({service_name=\"postgres\", deployment_environment_name=\"production\"} |= \"duration:\" [5m])) > bool 10"
      })
    }

    labels = {
      alert_group = "postgres"
      severity    = "warning"
    }

    annotations = {
      summary     = "Postgres is logging slow queries persistently"
      description = <<-EOT
        Counts log lines containing "duration:" - emitted once per slow statement
        by both log_min_duration_statement and auto_explain (each qualifying
        statement produces two such lines, one from each mechanism - see
        postgres.deployment.yaml), so this is roughly double the actual slow-query
        count. More than 10 in a 5m window, sustained for 5m, so a single transient
        slow query doesn't page anyone. No established baseline yet - adjust once
        you know what's normal. Scoped to the production environment so a
        devcontainer test run (ENVIRONMENT: development) can't page anyone.
      EOT
    }
  }

  rule {
    name          = "PostgresDeadTupleRatioHigh"
    condition     = "A"
    for           = "1h"
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
          max(
            (
              pg_stat_user_tables_n_dead_tup{deployment_environment_name="production"}
              /
              (
                pg_stat_user_tables_n_dead_tup{deployment_environment_name="production"}
                +
                pg_stat_user_tables_n_live_tup{deployment_environment_name="production"}
              )
            )
            and (pg_stat_user_tables_n_live_tup{deployment_environment_name="production"} > 1000)
          ) > bool 0.5
        EOT
      })
    }

    labels = {
      alert_group = "postgres"
      severity    = "warning"
    }

    annotations = {
      summary     = "A table's dead tuple ratio has stayed above 50% for an hour"
      description = <<-EOT
        Dead tuples (n_dead_tup) as a share of a table's rows (n_dead_tup +
        n_live_tup) - autovacuum's default scale factor already lets this ratio
        cycle up toward ~20% between runs, so 50% signals autovacuum genuinely
        falling behind rather than a normal catch-up cycle. Sustained for 1h to
        filter out that normal cycling. Restricted to tables with more than 1000
        live rows so small/lookup tables (where a handful of dead rows is a huge
        percentage but irrelevant in practice) can't trigger it. Deliberately does
        NOT fire on missing data. Scoped to the production environment so a
        devcontainer test run (ENVIRONMENT: development) can't page anyone.
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

  policy {
    contact_point = grafana_contact_point.cloudflared.name

    matcher {
      label = "alert_group"
      match = "="
      value = "kubernetes"
    }
  }

  policy {
    contact_point = grafana_contact_point.cloudflared.name

    matcher {
      label = "alert_group"
      match = "="
      value = "postgres"
    }
  }
}
