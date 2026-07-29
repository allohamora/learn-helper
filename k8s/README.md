# Running Kubernetes (k3d) inside devcontainers

```bash
# Create a single-node k3d cluster. --agents defaults to 0, so the one server node
# acts as both control plane and worker, mirroring Nomad dev-mode's combined
# server+client agent. No --port/--volume mapping: nothing is exposed to the host by
# default, and Postgres storage uses k3d's default local-path provisioner (see the
# persistence note below).
k3d cluster create learn-helper

# k3d auto-merges kubeconfig into ~/.kube/config and switches the current context to
# k3d-learn-helper, so kubectl works immediately in this same terminal.
kubectl get nodes

# k3d's underlying k3s bundles Traefik as a built-in component (installed in the
# kube-system namespace), including its CRDs (IngressRoute, Middleware). We reuse it
# instead of running our own Traefik Deployment. Confirm it's v3.x (CRD API group
# traefik.io) before applying the manifests below, since they assume v3 syntax -
# if it's ever v2 (traefik.containo.us), the IngressRoute/Middleware specs would need adjusting.
kubectl get deploy traefik -n kube-system -o jsonpath='{.spec.template.spec.containers[0].image}'

# Build the app image
docker build -t learn-helper:local .

# k3d node containers don't see the devcontainer's Docker daemon images by default;
# import the freshly built image directly into the cluster's containerd (no registry needed).
k3d image import learn-helper:local -c learn-helper

# Create the namespace, then Postgres (must be running before the app)
kubectl apply -f k8s/namespace.yml
kubectl apply -f k8s/postgres/
kubectl -n learn-helper rollout status deployment/postgres

# Apply all pending Drizzle migrations against the in-cluster Postgres database.
# Port-forward rather than a NodePort: it's on-demand and only needs to live for the
# duration of this command (defaults match the values baked into k8s/postgres/postgres.deployment.yml: app/example/app).
kubectl -n learn-helper port-forward svc/postgres 5432:5432 &
POSTGRES_URL="postgres://app:example@localhost:5432/app" npm run migrations:up
kill %1   # stop the port-forward

# Create the app's env Secret from your local .env file (never read/printed by any tool)
kubectl -n learn-helper create secret generic learn-helper-env --from-env-file=.env

# Configure the Cloudflare Tunnel before applying the complete Kustomize deployment.
# One-time setup in the Cloudflare Zero Trust dashboard (Networks > Tunnels):
#   1. Create a tunnel, choose "Docker" as the connector environment, copy the token.
#   2. On the same tunnel, add a Public Hostname (e.g. learn-helper.example.com)
#      routing to HTTP / traefik.kube-system.svc.cluster.local:80 - this is the
#      built-in Traefik's in-cluster Service DNS name, NOT localhost:80. Unlike the old
#      Nomad setup (which shared host networking between cloudflared and Traefik), k8s
#      Pods don't share network namespaces, so cloudflared reaches Traefik over the
#      cluster network instead.
#   3. That hostname MUST exactly match the Host(`...`) rule in k8s/learn-helper/ingress-routes/'s
#      IngressRoutes (defaults to `localhost`) - edit those files first if you're using a
#      real domain, since Traefik routes on Host() and a mismatch means Cloudflare
#      reaches Traefik fine but Traefik 404s it.
# Export the token in your shell first: export CLOUDFLARE_TUNNEL_TOKEN=...
kubectl -n learn-helper create secret generic cloudflared-token \
  --from-literal=TUNNEL_TOKEN="$CLOUDFLARE_TUNNEL_TOKEN"

# Apply the complete deployment. This also reconciles the namespace and Postgres
# resources applied during the staged migration setup above.
kubectl apply -k k8s
kubectl -n learn-helper rollout status deployment/learn-helper
kubectl -n learn-helper rollout status deployment/cloudflared

# Each component can also be reconciled independently when needed.
kubectl apply -k k8s/postgres
kubectl apply -k k8s/middlewares
kubectl apply -k k8s/learn-helper
kubectl apply -k k8s/cloudflared

# Verify by port-forwarding the built-in Traefik's Service (no host port is exposed
# by the cluster itself, see the persistence/exposure note below).
kubectl -n kube-system port-forward svc/traefik 8080:80 &
curl -i http://localhost:8080/                # HTML router: Cache-Control: private, max-age=0, must-revalidate
curl -i http://localhost:8080/api/...          # /api/ router: no cache header
curl -i http://localhost:8080/favicon.ico      # favicon router: 1-day public cache + Vary
kill %1   # stop the port-forward

# Remove the complete deployment, including its namespace and Postgres volume claim.
kubectl delete -k k8s

# Pause/resume the cluster itself across devcontainer sessions.
# Postgres data survives stop/start (the node container isn't removed).
k3d cluster stop learn-helper
k3d cluster start learn-helper

# Full teardown / start over from scratch.
# Postgres data does NOT survive this - k3d's default local-path storage lives inside
# the node container, which delete removes. Re-run npm run migrations:up after recreating.
k3d cluster delete learn-helper
```
