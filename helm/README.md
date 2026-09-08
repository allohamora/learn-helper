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

# Grafana Alloy (Database Observability -> Grafana Cloud)

Alloy is disabled by default (`alloy.enabled: false`). It exists solely to run Grafana
Cloud's [Database Observability](https://grafana.com/docs/grafana-cloud/observe-and-act/monitor-applications/database-observability/)
(DBO) integration for Postgres - query samples with wait events, `EXPLAIN` plans, and
schema catalog data, collected through a dedicated low-privilege `db-o11y` Postgres role
rather than the app's own credentials. Everything else this pipeline used to collect
(generic Postgres metrics, k3s/host/cloudflared metrics, kube-state-metrics, Kubernetes
events, raw pod logs) has been removed - this is DBO-only, nothing more. The app's own
traces/logs/HTTP metrics go straight to Sentry (see `src/server/instrument.ts`) and
aren't part of this pipeline either.

To enable it:

1. In Grafana Cloud, go to Connections > Add new connection > OpenTelemetry (OTLP) to
   find your stack's OTLP gateway endpoint and instance ID.
2. On the same page, generate an Access Policy token scoped to `metrics:write` and
   `logs:write`.
3. Add these under `alloy.env` in `values.yaml`, set `alloy.enabled: true`, and pick a
   password for the new `db-o11y` monitoring role under `postgres.env`:
   ```yaml
   alloy:
     enabled: true
     env:
       GRAFANA_CLOUD_OTLP_ENDPOINT: https://otlp-gateway-<region>.grafana.net/otlp
       GRAFANA_CLOUD_INSTANCE_ID: '<instance-id>'
       GRAFANA_CLOUD_API_TOKEN: <token>
   postgres:
     env:
       DB_O11Y_PASSWORD: <pick a password>
   ```
4. Re-run the `helm upgrade` command from the install/update steps above. This also
   restarts postgres (`shared_preload_libraries=pg_stat_statements` and the Database
   Observability-required settings are now set on its container args), which is
   required before the one-time steps below will work.
5. One-time: create the `pg_stat_statements` extension in the app database (safe to
   re-run; the deployment's `postgres.deployment.yaml` sets `shared_preload_libraries`
   unconditionally, but the extension itself is still opt-in per-database):
   ```bash
   kubectl exec -n learn-helper deploy/postgres -- psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" \
     -c 'CREATE EXTENSION IF NOT EXISTS pg_stat_statements;'
   ```
6. One-time: create the `db-o11y` role Alloy uses for Database Observability, with the
   password chosen in step 3 (`pg_monitor`/`pg_read_all_stats` give it read-only access
   to stats views; `pg_stat_statements.track = 'none'` keeps its own monitoring queries
   out of the query-stats data it's collecting):
   ```bash
   kubectl exec -n learn-helper deploy/postgres -- psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" -v ON_ERROR_STOP=1 <<'EOF'
   CREATE USER "db-o11y" WITH PASSWORD '<matches DB_O11Y_PASSWORD in values.yaml>';
   GRANT pg_monitor TO "db-o11y";
   GRANT pg_read_all_stats TO "db-o11y";
   ALTER ROLE "db-o11y" SET pg_stat_statements.track = 'none';
   GRANT USAGE ON SCHEMA public TO "db-o11y";
   GRANT SELECT ON ALL TABLES IN SCHEMA public TO "db-o11y";
   EOF
   ```

```bash
# Verify Alloy is scraping/shipping correctly.
kubectl -n learn-helper logs deploy/alloy

# Reach Alloy's own UI/health endpoint.
kubectl -n learn-helper port-forward deploy/alloy 12345:12345
```

In Grafana Cloud, confirm data is arriving: Explore > Metrics and Explore > Logs, both
filtered on `job="integrations/db-o11y"`. Once data is flowing, query samples, explain
plans, and schema data actually surface in Grafana Cloud's **Database Observability**
app, not Explore.

Changing `alloy.env`/`postgres.env` (e.g. rotating the API token or the `db-o11y`
password) follows the same `helm upgrade` flow as the `postgres.env`/`app.env` update
steps above - rotating `DB_O11Y_PASSWORD` also needs an `ALTER ROLE "db-o11y" WITH
PASSWORD '<new-password>';` run first, same as the note on `POSTGRES_PASSWORD` above.

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
