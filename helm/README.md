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
network) from the `node-exporter` DaemonSet's `/metrics` endpoint on port 9100. All of
it ships to Grafana Cloud over OTLP, with every metric/log getting a
`deployment.environment.name` resource attribute so production and non-production data
can be told apart. Postgres metrics and `app` pod logs are still not collected. The
app's own traces/logs/HTTP metrics go straight to Sentry (see
`src/server/instrument.ts`) and aren't part of this pipeline either.

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

To also collect host metrics, set `nodeExporter.enabled: true` in `values.yaml`
(`nodeExporter.image` defaults to `quay.io/prometheus/node-exporter:v1.12.1` in
`values.example.yaml`) and re-run `helm upgrade` again. It only needs Alloy enabled to
be useful - on its own it just runs an unscraped `/metrics` endpoint.

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
requests, stream errors, origin error rate, and logs)
and its 4 alert rules (degraded HA connections, origin errors, elevated error logs,
fatal log), plus the email contact
point/notification policy that routes them, are managed by Terraform - see
`terraform/README.md`. The dashboard JSON lives at `terraform/dashboards/cloudflared.json`
and the alert rules at `terraform/alerting.tf`; run `terraform apply` there to create or
update them. None of this is deployed by the Helm chart itself. Alloy only ships the
handful of `cloudflared_tunnel_*` metrics (plus `process_start_time_seconds`) that
back these panels/alerts - see the `prometheus.relabel "cloudflared_keep"` component in
`alloy/_config.alloy`.

Likewise, the `Node Exporter` dashboard (CPU usage, memory usage, swap usage, disk usage
%, disk load %, network traffic, uptime, and OOM kills) and its 5 alert rules (low memory, high CPU,
low disk space, swap filling up, OOM kill detected) route through the same contact
point/notification policy. The dashboard JSON lives at
`terraform/dashboards/node-exporter.json` and the alert rules are in the same
`terraform/alerting.tf`. node-exporter itself only runs the collectors those panels/alerts
need (see its `--collector.*` args in `node-exporter.daemonset.yaml`), and Alloy further
filters to the exact metric names used (`prometheus.relabel "node_exporter_keep"`).

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
