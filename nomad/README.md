# Running Nomad inside devcontainers

```bash
# Static host volumes are not created by Nomad. Provision this directory on every
# Nomad client node eligible to run Postgres before starting the Nomad client:
sudo install -d -m 0755 /opt/nomad/volumes/postgres-data

# Start a local Nomad dev agent from the project root
# Pass nomad/devcontainer.hcl to override faulty CPU detection inside containers
sudo nomad agent -dev -config=nomad/devcontainer.hcl -config=nomad/nomad.hcl

# Build the app image
docker build -t learn-helper:local .

# Nomad UI is available at http://localhost:4646/
# Run Traefik (available at :80 inside the devcontainer, dashboard at http://localhost:8080/dashboard/)
# check the Ports tab in your devcontainer tooling (e.g. VS Code) for the host-side port numbers.
nomad job run nomad/traefik.hcl

# Run Postgres (must be running before the app; defaults match docker-compose: app/example/app)
# The static host_volume path declared in nomad/nomad.hcl was provisioned above.
# Publishes two ports (see nomad/postgres.hcl):
#  - a "private" (docker0) port, registered as the "postgres" Nomad service, used by other
#    Nomad allocations (e.g. the learn-helper app) to reach Postgres.
#  - a static 127.0.0.1:5432 loopback port, reachable only from the Nomad host itself, meant
#    for admin access (migrations below, or an SSH tunnel from your laptop).
nomad job run nomad/postgres.hcl

# Apply all pending Drizzle migrations to the Nomad Postgres database
# (runs from the Nomad host itself, so it uses the loopback port, not the "postgres" service)
POSTGRES_HOST=localhost \
POSTGRES_PORT=5432 \
POSTGRES_USER=app \
POSTGRES_PASSWORD=example \
POSTGRES_DB=app \
npm run migrations:up

# Run the app
# check the Ports tab in your devcontainer tooling (e.g. VS Code) for the host-side port numbers.
# POSTGRES_USER, POSTGRES_PASSWORD, and POSTGRES_DB must be set in .env and must match
# the values passed to postgres.hcl. Nomad service discovery injects POSTGRES_HOST and
# POSTGRES_PORT from the registered "postgres" service.
nomad job run -var="image=learn-helper:local" -var="env=$(cat .env)" nomad/learn-helper.hcl

# Run the Cloudflare Tunnel
# One-time setup in the Cloudflare Zero Trust dashboard (Networks > Tunnels):
#   1. Create a tunnel, choose "Docker" as the connector environment, copy the token.
#   2. On the same tunnel, add a Public Hostname (e.g. learn-helper.example.com)
#      routing to HTTP / localhost:80 (cloudflared shares the host network
#      namespace with Traefik, so this reaches Traefik directly).
#   3. That hostname MUST exactly match the -var="domain=..." value passed to
#      learn-helper.hcl above, since Traefik routes on Host(`${var.domain}`) -
#      a mismatch means Cloudflare reaches Traefik fine but Traefik 404s it.
# Export the token in your shell first: export CLOUDFLARE_TUNNEL_TOKEN=...
nomad job run -var="token=$CLOUDFLARE_TUNNEL_TOKEN" nomad/cloudflared.hcl

# Stop the jobs
nomad job stop cloudflared
nomad job stop learn-helper
nomad job stop postgres
nomad job stop traefik
```
