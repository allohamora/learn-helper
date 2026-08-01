# Running Kubernetes (k3d) inside devcontainers

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
  --atomic \
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
  --atomic \
  --wait \
  --timeout 10m \
  --set-string app.image=learn-helper:v2

# Seed the database manually (one-off, run against the live app pod).
kubectl exec -n learn-helper deploy/app -- npm run vocabulary:seed

# Remove the release. The postgres-data PVC is kept (helm.sh/resource-policy: keep),
# so postgresql data survives this step.
helm uninstall learn-helper --namespace learn-helper

# Remove the postgres data volume. This permanently deletes the database - only
# run it once you're sure you no longer need the data.
kubectl delete pvc postgres-data --namespace learn-helper

# Remove the now-empty namespace.
kubectl delete namespace learn-helper

# Delete the local cluster.
k3d cluster delete learn-helper
```

# Database backups

```bash
# Back up the database to a local, timestamped, gzip-compressed SQL file.
kubectl exec -n learn-helper deploy/postgres -- \
  pg_dump -U app -d test | gzip > "backup-$(date +"%Y-%m-%d").sql.gz"

# Restore the database from a backup made with the command above. Scale the
# app down first so nothing is writing mid-restore, then scale it back up.
kubectl scale -n learn-helper deploy/app --replicas=0
gunzip -c backup-2026-08-01.sql.gz | kubectl exec -i -n learn-helper deploy/postgres -- psql -U app -d test
kubectl scale -n learn-helper deploy/app --replicas=1
```
