# Running Kubernetes (k3s) inside devcontainers

```bash
# Create a single-node k3d cluster.
k3d cluster create learn-helper

# Copy the example values
cp helm/values.example.yaml helm/values.yaml

# Build the app image and import it into the k3d node.
docker build -t learn-helper:local .
k3d image import learn-helper:local -c learn-helper

# Install: deploy the complete stack for the first time.
helm upgrade --install learn-helper helm \
  --namespace learn-helper \
  --create-namespace \
  --rollback-on-failure \
  --wait \
  --timeout 10m

# Verify through the built-in Traefik Service. These URLs assume domain remains
# localhost in values.yaml. Run this in its own terminal and leave it running.
kubectl -n kube-system port-forward svc/traefik 8080:80

# Admin panel: browse and manage the cluster's resources interactively.
k9s -n learn-helper

# Update: deploy a new app build without editing values.yaml.
docker build -t learn-helper:v2 .
k3d image import learn-helper:v2 -c learn-helper

helm upgrade learn-helper helm \
  --namespace learn-helper \
  --rollback-on-failure \
  --wait \
  --timeout 10m \
  --set-string app.image=learn-helper:v2

# Update env vars: edit helm/values.yaml, then re-run without touching the image.
helm upgrade learn-helper helm \
  --namespace learn-helper \
  --rollback-on-failure \
  --wait \
  --timeout 10m

# Seed the database manually (one-off, run against the live app pod).
kubectl exec -n learn-helper deploy/app -- npm run vocabulary:seed

# Remove the release. The postgres-data and app-uploads PVCs are kept
# (helm.sh/resource-policy: keep), so postgresql data and uploaded files survive
# this step.
helm uninstall learn-helper --namespace learn-helper

# Remove the postgres data volume. This permanently deletes the database - only
# run it once you're sure you no longer need the data.
kubectl delete pvc postgres-data --namespace learn-helper

# Remove the uploaded files volume. This permanently deletes all uploaded PDFs -
# only run it once you're sure you no longer need them.
kubectl delete pvc app-uploads --namespace learn-helper

# Remove the now-empty namespace.
kubectl delete namespace learn-helper

# Delete the local cluster.
k3d cluster delete learn-helper
```

# Grafana Alloy (cloudflared metrics/logs -> Grafana Cloud)

Alloy is disabled by default (`alloy.enabled: false`). It collects the cloudflared
tunnel's own Prometheus metrics (connection health, request counts, error rates - the
`/metrics` endpoint cloudflared's deployment already exposes on port 2000) and its pod
logs, and - when `nodeExporter.enabled: true` - host metrics (CPU, memory, disk,
network) from the `node-exporter` DaemonSet's `/metrics` endpoint on port 9100, along
with its pod logs. When `kubeStateMetrics.enabled: true`, it additionally collects
Kubernetes' own view of cluster state: pod phase/restarts/OOMKilled reasons,
Deployment/DaemonSet replica availability, and Node `Ready` condition from the
`kube-state-metrics` Deployment; per-container CPU/memory usage
scraped directly from every node's kubelet (`/metrics/cadvisor`, proxied through the API
server); and every Kubernetes event (routine, e.g. `Pulled`/`Created`/`Started`, and
`Warning`, e.g. `FailedScheduling`/`BackOff`/`FailedMount`) as logs. When
`postgresExporter.enabled: true`, it additionally collects Postgres query/connection
metrics (connections, cache hit ratio, transactions, deadlocks, locks, and database
size) from a `postgres-exporter` sidecar's `/metrics` endpoint on port 9187, along with
the `postgres` container's own plain-text logs (slow queries and `auto_explain` plans
included, the latter with its plan JSON-formatted within the log line). Except for Node metrics (nodes aren't namespaced), all
of this is scoped to this release's own namespace, so other namespaces' own components
(e.g. `kube-system`'s coredns/traefik) don't clutter `dashboards/kubernetes.json`. All of
it ships to Grafana Cloud over OTLP, with every metric/log getting a
`deployment.environment.name` resource attribute so production and non-production data
can be told apart. `app` pod logs are still not collected. The app's own traces/logs/HTTP
metrics go straight to Sentry (see `src/server/instrument.ts`) and aren't part of this
pipeline either - there's no Kubernetes-level equivalent of traces to collect here, so
none is added.

To enable it:

1. Run `terraform apply` in `terraform/` (see `terraform/README.md`) - it provisions the
   OTLP access policy/token in Grafana Cloud.
2. Fetch the endpoint and headers with the `terraform console` commands in
   `terraform/README.md`'s "Use" section. The headers value is just the raw
   `base64(instance_id:token)` value (the chart adds the `Basic ` scheme prefix itself).
3. Add these under `alloy.env` in `values.yaml`, along with `ENVIRONMENT` (`production`
   or `development`), and set `alloy.enabled: true`:
   ```yaml
   alloy:
     enabled: true
     env:
       OTEL_EXPORTER_OTLP_ENDPOINT: <otel_exporter_otlp_endpoint output>
       OTEL_EXPORTER_OTLP_HEADERS: '<otel_exporter_otlp_headers output>'
       ENVIRONMENT: production
   ```
4. Re-run the `helm upgrade` command from the install/update steps above.

`values.schema.json` requires `nodeExporter`, `kubeStateMetrics`, and `postgresExporter`
blocks, so an existing `values.yaml` must add them (copy from `values.example.yaml`,
`enabled: false`) before the next `helm upgrade`, even if host/cluster/Postgres metrics
aren't wanted.

To also collect host metrics, set `nodeExporter.enabled: true` in `values.yaml`
(`nodeExporter.image` defaults to `quay.io/prometheus/node-exporter:v1.12.1` in
`values.example.yaml`) and re-run `helm upgrade` again. It only needs Alloy enabled to
be useful - on its own it just runs an unscraped `/metrics` endpoint.

To also collect cluster-level Kubernetes metrics/events, set
`kubeStateMetrics.enabled: true` in `values.yaml` (`kubeStateMetrics.image` defaults to
`registry.k8s.io/kube-state-metrics/kube-state-metrics:v2.20.0` in
`values.example.yaml`) and re-run `helm upgrade` again. Enabling it is also the first
time Alloy's ServiceAccount gets cluster-wide (not namespace-scoped) read access - a
`ClusterRole`/`ClusterRoleBinding` (`alloy.cluster-role.yaml`) granting `list`/`watch` on
nodes, `get` on `nodes/proxy` (for the kubelet cAdvisor scrape), and `list`/`watch`/`get`
on events cluster-wide - a deliberate, expected step for a cluster monitoring agent, but
worth noting since every prior Alloy source only ever needed access to its own namespace.
This grant is broader than what's actually watched: the kubelet/cAdvisor scrape and the
events log source (`loki.source.kubernetes_events`'s `namespaces` argument) both filter
down to this release's own namespace client-side, and `kube-state-metrics` restricts
itself to it directly via `--namespaces`.

To also collect Postgres metrics/logs, set `postgresExporter.enabled: true` in
`values.yaml` (`postgresExporter.image` defaults to
`quay.io/prometheuscommunity/postgres-exporter:v0.17.1` in `values.example.yaml`) and
re-run `helm upgrade`. This adds a `postgres-exporter` sidecar container to the existing
`postgres` pod (same network namespace, no new Service) and starts Alloy shipping its
metrics and the `postgres` container's own logs (see the Alloy section above). The
`postgres` container's `pg_stat_statements`/`auto_explain` preload and logging settings -
see the `args` in `postgres.deployment.yaml` for the full parameter list - are applied
unconditionally and aren't gated on this flag; they're already active regardless of
whether `postgresExporter` is enabled.

`pg_stat_statements` is preloaded and required by the `Postgres` dashboard's "Top queries
by time" panel, via the `postgres-exporter`'s `stat_statements` collector - the slow query
rate panel and alert come from `auto_explain`'s own logs instead and don't need it. Since
the extension isn't created automatically, run this once against the live database
(idempotent) for that panel to populate:

```bash
kubectl exec -n learn-helper deploy/postgres -c postgres -- psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" -c 'CREATE EXTENSION IF NOT EXISTS pg_stat_statements;'
```

This is a one-time manual step, not a Drizzle migration (`migrations/` manages the app's
own schema, not server-level extensions) - run it after the `helm upgrade` above has
restarted the pod. `auto_explain` needs no equivalent step; it's a preload-only module,
not a SQL extension.

```bash
# Verify Alloy is scraping/shipping correctly.
kubectl -n learn-helper logs deploy/alloy

# Reach Alloy's own UI/health endpoint.
kubectl -n learn-helper port-forward deploy/alloy 12345:12345
```

Confirm data is arriving via the Terraform-managed `Cloudflared Tunnel` dashboard in Grafana
Cloud, or via Drilldown > Metrics/Logs filtered on `job="cloudflared"`/`service_name="cloudflared"`.

Changing `alloy.env` (e.g. rotating the API token, or switching `ENVIRONMENT`) follows
the same `helm upgrade` flow as the `postgres.env`/`app.env` update steps above.

## Dashboard and alerts

The goal here is to collect and alert on only what's actually useful, not everything
these tools can expose. node-exporter's defaults and cloudflared's `/metrics` endpoint
between them offer well over a hundred metric families; shipping all of it to Grafana
Cloud would mean paying for and scrolling past series nobody looks at. So this is
intentional, not partial or unfinished: node-exporter only runs the collectors its
panels/alerts need, Alloy further filters both scrape jobs down to the exact metric
names a panel or alert reads, and every alert rule has a corresponding dashboard panel
so firing one always has somewhere to look for the "why." Adding a new panel or alert is
expected to come with adding the metric it needs to the relevant `keep` allow-list (and
vice versa - a metric with no panel or alert reading it should come back out).

The `Cloudflared Tunnel` dashboard (HA connections, uptime, errors, requests, concurrent
requests, stream errors, origin error rate, responses by status code, and logs)
and its 4 alert rules (degraded HA connections, origin errors, elevated error logs,
fatal log), plus the email contact
point/notification policy that routes them, are managed by Terraform - see
`terraform/README.md`. The dashboard JSON lives at `terraform/dashboards/cloudflared.json`
and the alert rules at `terraform/alerting.tf`; run `terraform apply` there to create or
update them. None of this is deployed by the Helm chart itself. Alloy only ships the
handful of `cloudflared_tunnel_*` metrics (plus `process_start_time_seconds`) that
back these panels/alerts - see the `prometheus.relabel "cloudflared_keep"` component in
`alloy/_config.alloy`. Responses by status code is the one place an actual application
response code is visible here - distinct from the Errors panel (connection-level failures
that never produce a status code) and from Sentry (which only sees responses the app
itself generated, not ones Cloudflare's edge or Traefik return before a request reaches
it). It has no alert yet. cloudflared exposes no per-request duration metric at all - its
only latency-shaped metric (`cloudflared_proxy_connect_latency`, connection-setup time)
was tried and dropped since it only samples on a fresh connect and sat empty in practice;
actual request/response timing for the app is Sentry's job, not this pipeline's.

Likewise, the `Node Exporter` dashboard (CPU usage, memory usage, swap usage, disk usage
%, filesystem inodes %, disk load %, disk throughput, network traffic, network
errors/drops, uptime, and OOM kills) and its 5 alert rules (low memory, high CPU, low
disk space, swap filling up, OOM kill detected) route through the same contact
point/notification policy. The dashboard JSON lives at
`terraform/dashboards/node-exporter.json` and the alert rules are in the same
`terraform/alerting.tf`. node-exporter itself only runs the collectors those panels/alerts
need (see its `--collector.*` args in `node-exporter.daemonset.yaml`), and Alloy further
filters to the exact metric names used (`prometheus.relabel "node_exporter_keep"`).
Filesystem inodes %, disk throughput, and network errors/drops have no alert yet - they
exist for visibility into failure modes (running out of inodes despite free bytes, a NIC
dropping packets) their neighboring panels can't show on their own. Swap activity
(`node_vmstat_pswpin`/`pswpout`) was tried and dropped: it only reads non-zero once swap
usage is already moving, so it never told you anything the Swap usage panel above didn't
already show first.

Likewise, the `Kubernetes Cluster` dashboard (per-service replica count, pod restarts, container
OOMKilled count, Node `Ready` condition, per-service CPU/memory usage, and events)
and its 7 alert rules (pod crash-looping, unavailable Deployment replicas, container
OOMKilled, node not ready, elevated Warning events, high per-container CPU/memory usage)
route through the same contact point/notification policy. The dashboard JSON lives at
`terraform/dashboards/kubernetes.json` and the alert rules are in the same
`terraform/alerting.tf`. `kube-state-metrics` only watches the object kinds those
panels/alerts need (see its `--resources=...` flag and
`kube-state-metrics.cluster-role.yaml`), and Alloy filters the kube-state-metrics and
kubelet/cAdvisor scrapes down to the exact metric names used (see the
`kube_state_metrics_keep`/`kubelet_cadvisor_keep` components in `alloy/_config.alloy`). The
CPU/memory panels group by `container` (i.e. by service - `app`, `postgres`, `cloudflared`,
...) and show each as a percentage of that container's own configured `resources.limits`
(e.g. 50% means using half of what it's allowed), not raw cores/bytes and not relative to
the host - `kube_pod_container_resource_limits` (kube-state-metrics) is the denominator;
`PodCpuUsageHigh`/`PodMemoryUsageHigh` alert on the same per-(pod, container) query
crossing 80%. A per-PVC disk usage % panel/alert was tried and dropped - see
`alloy/_config.alloy`'s comment above the events source for why kubelet can't give a real
per-PVC number on this cluster's `local-path` storage class.
Service replicas shows each service's current available/ready replica count (Deployments
and the node-exporter DaemonSet, unified onto one `service` label) rather than a separate
up/down flag - the DeploymentReplicasUnavailable alert still reads
`kube_deployment_status_replicas_unavailable` directly even though it no longer backs its
own dashboard panel. The events log source ships every event type, unfiltered - the
`KubernetesWarningEventsElevated` alert filters to `type="Warning"` itself in its own Loki
query, rather than relying on a curated pipeline.

Likewise, the `Postgres` dashboard (connections as a share of `max_connections`, cache hit
ratio, transactions/sec, CPU usage %, memory usage %, slow query rate, database size,
deadlocks, locks by mode, dead tuples, sequential scan share, time since last autovacuum,
top queries by time, and unfiltered logs) and its 5 alert rules (connections high, cache
hit ratio low, slow query detected, dead tuple ratio high, error logs elevated) route
through the same contact point/notification policy. The dashboard JSON lives at
`terraform/dashboards/postgres.json` and the alert rules are in the same
`terraform/alerting.tf`. Alloy filters the postgres-exporter scrape down to the exact
metric names used (`prometheus.relabel "postgres_keep"` in `alloy/_config.alloy`). The
slow query rate panel and alert both match log lines containing `"duration:"`, which
both `log_min_duration_statement` and `auto_explain` emit per qualifying statement - each
slow query is counted roughly twice, one line per mechanism. Read/write query latency
(derived from `pg_stat_statements`) was tried as a metric/alert pair and dropped: it was
only an _average_ execution time per call, not a true latency percentile the way RDS's
`ReadLatency`/`WriteLatency` are, since `pg_stat_statements` only exposes cumulative
sums/counts - it's used for the top-queries-by-time panel's ranking instead, where an
average is good enough.
Deliberately not added: a Postgres-specific CPU/memory alarm (already generic
per-`container` in the `Kubernetes Cluster` dashboard/`ContainerOomKilled`), a storage/free-space alarm
(`HostOutOfDiskSpace` already covers the underlying filesystem `local-path` writes to),
a swap alarm (already `HostOutOfSwap`), and anything with no bare-metal equivalent (CPU/
burst credits, EBS burst-balance, replica lag, RDS-style snapshot/deletion-protection
alarms - backups here are `scripts/backup-db.sh`'s separate `pg_dump` flow).

None of these alert rules try to detect "the exporter/tunnel stopped responding" (no
`NodeExporterDown`/`CloudflaredDown`-style rule, and every rule uses
`no_data_state = "OK"`). That's deliberate, not an oversight: this host is expected to be
powered off manually for large stretches of time and brought back online later, so absence
of data is the normal state, not an anomaly - a rule that alerted on it would mostly be
alerting on the host being off, which nobody needs to hear about. The tradeoff is that a
crashed node-exporter or Alloy process on a host that's still otherwise up also looks like
"no data" from here and won't page anyone either; that's accepted given how much of this
host's time is expected to be offline anyway.

# Production setup notes

## SSH access via Cloudflare Zero Trust

1. In the Cloudflare dashboard, go to Zero Trust > Networks > Tunnels and mesh > Create a tunnel, choose Cloudflared, and give it a name. Run the arm64 Linux install commands it shows, installing it as a service so it keeps running. Add a public hostname route: `ssh.example.com` + `ssh://localhost:22`.
2. Go to Service credentials > Service tokens > Add a token, and copy the client ID and secret.
3. Create a `production` environment on GitHub and add `CLOUDFLARE_ACCESS_CLIENT_ID` and `CLOUDFLARE_ACCESS_CLIENT_SECRET` as its secrets.
4. Go to Access > Applications > Add an application, choose Self-hosted > Public DNS, then set the public hostname field to the SSH route from step 1.
5. Add a policy named "Allow me" with Action: Allow, Include > Emails > your email address.
6. Add a second policy with Include > Service Token > the token from step 2, and Action: Service Auth. Save.
7. Run `cloudflared access login <hostname>` to authenticate, then you can connect with `ssh -o ProxyCommand="cloudflared access ssh --hostname %h" <user>@<hostname>`.

## GitHub Actions deploy access

8. Generate a dedicated deploy keypair (`ssh-keygen -t ed25519 -f deploy_key -N ""`), add the public half to the server's `~/.ssh/authorized_keys` for the login user, and store the private key contents as the `SSH_PRIVATE_KEY` secret in the `production` GitHub environment.
9. Add a `SSH_HOSTNAME` secret in the `production` GitHub environment, set to the public hostname from step 1.
10. Add a `SSH_USER` repository secret, set to the server's login user (e.g. `pi`).
11. On the server, read its SSH host public key:
    ```bash
    cat /etc/ssh/ssh_host_ed25519_key.pub
    ```
    It has three space-separated tokens — type, value, comment. Take the type and value, prepend the hostname from step 9 in place of the comment, and add the result as a `SSH_KNOWN_HOSTS` secret in the `production` GitHub environment, in the format `<hostname> <type> <value>` (e.g. `ssh.example.com ssh-ed25519 AAAA...`). This lets GitHub Actions verify the server's identity instead of trusting whatever host key is presented at connection time.

## Server software

12. Install k3s using the official install script from k3s.io.
13. Create a dedicated group for containerd socket access and add the deploy user (the `SSH_USER` from step 10) to it, so deploys can import images without sudo:
    ```bash
    sudo groupadd k3s-ctr
    sudo usermod -aG k3s-ctr <deploy-user>
    ```
14. Add a systemd drop-in that re-applies the socket's group ownership every time k3s (re)starts. This survives k3s restarts and upgrades because it's a supplementary unit fragment systemd merges with `k3s.service` at load time — it doesn't touch or depend on k3s's own unit file, so upgrading/reinstalling k3s never removes it:
    ```bash
    sudo mkdir -p /etc/systemd/system/k3s.service.d
    printf '[Service]\nExecStartPost=/bin/chown root:k3s-ctr /run/k3s/containerd/containerd.sock\n' | sudo tee /etc/systemd/system/k3s.service.d/containerd-socket-perms.conf > /dev/null
    sudo systemctl daemon-reload
    sudo systemctl restart k3s
    ```
    Verify with `ls -l /run/k3s/containerd/containerd.sock` (expect `root k3s-ctr` ownership). The deploy user needs a fresh login (or `newgrp k3s-ctr`) to pick up the new group when testing interactively — GitHub Actions deploys are unaffected since each run opens a new SSH connection.
15. Make kubectl usable without sudo/root.
16. Install helm using the official Ubuntu install script.
17. Install k9s from its GitHub releases.
18. Install Docker using the official install script, if you don't have it.

## App ingress tunnel

19. Set up the app's own Zero Trust tunnel: choose Docker, copy the token, and point it at `http://traefik.kube-system.svc.cluster.local:80`.

## Deploy

20. Clone the repo onto the server and deploy the app for the first time.

# Database backups

```bash
# Back up the database to a local, timestamped, gzip-compressed SQL file. See scripts/backup-db.sh.
sh scripts/backup-db.sh

# Download the backups locally. See scripts/download-db-backups.sh.
sh scripts/download-db-backups.sh

# Restore the database from a backup made with the command above. Scale the
# app down first so nothing is writing mid-restore, then scale it back up.
kubectl scale -n learn-helper deploy/app --replicas=0
gunzip -c .temp/backups/<date>-data.sql.gz | kubectl exec -i -n learn-helper deploy/postgres -- sh -c 'psql -1 -v ON_ERROR_STOP=1 -U "$POSTGRES_USER" -d "$POSTGRES_DB"'
kubectl scale -n learn-helper deploy/app --replicas=1
```

# Uploads backups

```bash
# Back up the uploaded PDFs to a local, timestamped, gzip-compressed tarball. See scripts/backup-uploads.sh.
sh scripts/backup-uploads.sh

# Download the uploads backups locally. See scripts/download-uploads.sh.
sh scripts/download-uploads.sh

# Restore uploads from a backup made with the command above. The uploads volume is
# ReadWriteOnce, so scale the app down first (it's the only pod mounting it), restore
# through a temporary pod, then scale the app back up.
kubectl scale -n learn-helper deploy/app --replicas=0
gunzip -c .temp/uploads/<date>-uploads.tar.gz | kubectl run -n learn-helper uploads-restore --image=alpine --restart=Never --rm -i \
  --overrides='{
    "spec": {
      "containers": [{
        "name": "uploads-restore",
        "image": "alpine",
        "stdin": true,
        "command": ["tar", "xf", "-", "-C", "/app/uploads"],
        "volumeMounts": [{"name": "uploads", "mountPath": "/app/uploads"}]
      }],
      "volumes": [{"name": "uploads", "persistentVolumeClaim": {"claimName": "app-uploads"}}]
    }
  }'
kubectl scale -n learn-helper deploy/app --replicas=1
```
