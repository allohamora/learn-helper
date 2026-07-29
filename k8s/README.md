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

# Create the ignored per-service environment files used by Kustomize's
# secretGenerator entries, then replace every placeholder with the real value.
# Keep the Postgres user, password, and database name URL-safe because Kubernetes
# constructs POSTGRES_URL by direct string expansion and does not percent-encode it.
cp k8s/postgres/.env.example k8s/postgres/.env
cp k8s/learn-helper/.env.example k8s/learn-helper/.env
cp k8s/cloudflared/.env.example k8s/cloudflared/.env

# Build the app image
docker build -t learn-helper:local .

# k3d node containers don't see the devcontainer's Docker daemon images by default;
# import the freshly built image directly into the cluster's containerd (no registry needed).
k3d image import learn-helper:local -c learn-helper

# Create the namespace, then Postgres (must be running before the app).
# Kustomize's namespace field can assign a namespace to resources, but it does not
# create the Namespace itself, so namespace.yml remains an explicit resource.
kubectl apply -f k8s/namespace.yml
kubectl apply -k k8s/postgres
kubectl -n learn-helper rollout status deployment/postgres

# Apply all pending Drizzle migrations against the in-cluster Postgres database.
# Port-forward rather than a NodePort: it's on-demand and only needs to live for the
# duration of this command. Source the same ignored file that generated the Postgres
# Secret so the migration credentials stay synchronized with the Deployment.
kubectl -n learn-helper port-forward svc/postgres 5432:5432 &
set -a
. k8s/postgres/.env
set +a
POSTGRES_URL="postgres://$POSTGRES_USER:$POSTGRES_PASSWORD@localhost:5432/$POSTGRES_DB" npm run migrations:up
kill %1   # stop the port-forward

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
# Put the copied tunnel token in k8s/cloudflared/.env before continuing.

# Check that every Kustomization and referenced YAML file renders successfully.
# This is an offline check: it does not contact or modify the cluster.
kubectl kustomize k8s > /dev/null

# Validate the rendered resources against the active cluster's Kubernetes schemas
# and admission rules without persisting anything. The namespace and Traefik CRDs
# must already exist so the server can validate namespaced resources and custom kinds.
kubectl apply --dry-run=server --validate=strict -k k8s

# Apply the complete deployment. This also reconciles the namespace and Postgres
# resources applied during the staged migration setup above.
kubectl apply -k k8s
kubectl -n learn-helper rollout status deployment/learn-helper
kubectl -n learn-helper rollout status deployment/cloudflared

# Postgres, middlewares, and cloudflared can also be reconciled independently.
# Apply the root Kustomization for learn-helper because it references the generated
# Postgres Secret and Kustomize must transform both resources together.
kubectl apply -k k8s/postgres
kubectl apply -k k8s/middlewares
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

The `.env` files are ignored by Git, while the `.env.example` files document the
required keys without containing credentials. Kubernetes Secrets are base64-encoded,
not encrypted; restrict access to the files, cluster, and Secret resources accordingly.

Kustomize adds content hashes to generated Secret names and updates Deployment
references automatically, so applying a changed environment file rolls the consuming
Pod. Postgres only uses `POSTGRES_USER`, `POSTGRES_PASSWORD`, and `POSTGRES_DB` while
initializing an empty data directory. Changing those values later does not update users,
passwords, or databases stored on the existing persistent volume; rotate them inside
Postgres first or intentionally recreate the volume.
