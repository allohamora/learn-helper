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
