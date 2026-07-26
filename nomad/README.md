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
nomad job run nomad/postgres.hcl

# Apply all pending Drizzle migrations to the Nomad Postgres database
POSTGRES_URL=postgres://app:example@localhost:5432/app npm run migrations:up

# Run the app
# check the Ports tab in your devcontainer tooling (e.g. VS Code) for the host-side port numbers.
# The app's POSTGRES_URL in .env should point at
# postgres://app:example@host.docker.internal:5432/app.
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
