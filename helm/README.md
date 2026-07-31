# Running Kubernetes (k3d) inside devcontainers

This directory is a Helm 3 chart for Learn Helper, PostgreSQL, persistent
storage, Services, and Traefik routing.

Helm automatically loads only `helm/values.yaml`. The repository tracks
`helm/values.example.yaml` as a safe template and ignores `helm/values.yaml`
because it contains the local deployment configuration and credentials.
`values.local.yaml` is not used by this chart.

```bash
# Create a single-node k3d cluster.
k3d cluster create learn-helper
kubectl get nodes
helm version

# k3s bundles Traefik and its IngressRoute and Middleware CRDs. Confirm it is v3.x
# because this chart uses the traefik.io API group.
kubectl get deploy traefik -n kube-system -o jsonpath='{.spec.template.spec.containers[0].image}'

# Create Helm's automatically loaded values.yaml from the tracked example. Set
# domain, images, and the env.app and env.postgres YAML maps. Keep the Postgres
# values URL-safe because POSTGRES_URL is assembled directly and does not
# percent-encode them.
cp helm/values.example.yaml helm/values.yaml

# Build the app image and import it into the k3d node.
docker build -t learn-helper:local .
k3d image import learn-helper:local -c learn-helper

# Validate and render the chart locally.
helm lint helm
helm template learn-helper helm \
  --namespace learn-helper > /dev/null

# Install the complete stack.
helm upgrade --install learn-helper helm \
  --namespace learn-helper \
  --create-namespace \
  --atomic \
  --wait \
  --timeout 10m
kubectl -n learn-helper rollout status deployment/postgres

# Helm runs all pending Drizzle migrations after install and upgrade.
kubectl -n learn-helper rollout status deployment/app

# Validate the rendered resources against the active cluster without persisting
# changes. The cluster must already have the Traefik CRDs.
helm template learn-helper helm \
  --namespace learn-helper |
  kubectl apply --dry-run=server --validate=strict -f -

# Verify through the built-in Traefik Service. These URLs assume domain remains
# localhost in values.yaml.
kubectl -n kube-system port-forward svc/traefik 8080:80 &
curl -i http://localhost:8080/
curl -i http://localhost:8080/api/...
curl -i http://localhost:8080/favicon.ico
kill %1

# Reconcile chart or local values changes.
helm upgrade learn-helper helm \
  --namespace learn-helper \
  --atomic \
  --wait \
  --timeout 10m

# Remove the release and namespace.
helm uninstall learn-helper --namespace learn-helper
kubectl delete namespace learn-helper

# Pause, resume, or delete the local cluster.
k3d cluster stop learn-helper
k3d cluster start learn-helper
k3d cluster delete learn-helper
```

`domain` defaults to `localhost`. All four Traefik routes use the configured
value in their `Host(...)` matcher. Container images are configurable as full
image references, and environment variables are plain YAML maps:

```yaml
domain: learn.example.com

images:
  app: registry.example.com/learn-helper:latest
  postgres: postgres:18.4-alpine

env:
  app:
    EXAMPLE_APP_VARIABLE: example
  postgres:
    POSTGRES_USER: app
    POSTGRES_PASSWORD: replace-me
    POSTGRES_DB: learn-helper
```

Override either image on the command line without editing `values.yaml`:

```bash
helm upgrade --install learn-helper helm \
  --namespace learn-helper \
  --atomic \
  --wait \
  --timeout 10m \
  --set-string images.app=registry.example.com/learn-helper:123
```

`values.yaml` is ignored because it can contain credentials. Kubernetes Secrets
and Helm release data are encoded, not encrypted; restrict access to the local
values file, cluster, release, and Secret resources.

PostgreSQL only uses its user, password, and database values while initializing
an empty data directory. Changing them later does not update credentials stored
on the existing persistent volume.
