# Running Kubernetes (k3d) inside devcontainers

```bash
# Create a single-node k3d cluster.
k3d cluster create learn-helper

# Verify the installation.
kubectl get nodes
helm version

# k3s bundles Traefik and its IngressRoute and Middleware CRDs. Confirm it is v3.x
# because this chart uses the traefik.io API group.
kubectl get deploy traefik -n kube-system -o jsonpath='{.spec.template.spec.containers[0].image}{"\n"}'

# Copy the example values and edit domain, images, and the env.app / env.postgres
# maps. Keep Postgres values URL-safe (POSTGRES_URL is assembled without
# percent-encoding). values.yaml is gitignored since it can hold credentials.
cp helm/values.example.yaml helm/values.yaml

# Build the app image and import it into the k3d node.
docker build -t learn-helper:local .
k3d image import learn-helper:local -c learn-helper

# Validate and render the chart locally.
helm lint helm
helm template learn-helper helm \
  --namespace learn-helper > /dev/null

# Install: deploy the complete stack for the first time.
helm upgrade --install learn-helper helm \
  --namespace learn-helper \
  --create-namespace \
  --atomic \
  --wait \
  --timeout 10m
kubectl -n learn-helper rollout status deployment/postgres

# The app applies pending Drizzle migrations on boot, safe with multiple
# replicas via an advisory lock (see runMigrations in db.service.ts).
kubectl -n learn-helper rollout status deployment/app

# Validate the rendered resources against the active cluster without persisting
# changes. The cluster must already have the Traefik CRDs.
helm template learn-helper helm \
  --namespace learn-helper |
  kubectl apply --dry-run=server --validate=strict -f -

# Verify through the built-in Traefik Service. These URLs assume domain remains
# localhost in values.yaml. Run this in its own terminal and leave it running.
kubectl -n kube-system port-forward svc/traefik 8080:80

# In a second terminal, once the port-forward above prints "Forwarding from ...":
curl -i http://localhost:8080/
curl -i http://localhost:8080/api/swagger.json
curl -i http://localhost:8080/favicon.ico

# Update: deploy a new app build without editing values.yaml.
docker build -t learn-helper:v2 .
k3d image import learn-helper:v2 -c learn-helper
helm upgrade learn-helper helm \
  --namespace learn-helper \
  --atomic \
  --wait \
  --timeout 10m \
  --set-string images.app=learn-helper:v2

# Remove the release and namespace.
helm uninstall learn-helper --namespace learn-helper
kubectl delete namespace learn-helper

# Pause or delete the local cluster.
k3d cluster stop learn-helper
k3d cluster delete learn-helper
```
