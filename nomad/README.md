# Running Nomad and Consul inside devcontainers

```bash
# Static host volumes are not created by Nomad. Provision this directory on every
# Nomad client node eligible to run Postgres before starting the Nomad client:
sudo install -d -m 0755 /opt/nomad/volumes/postgres-data

# In a separate terminal, start a local Consul dev agent before starting Nomad.
# Development mode is for local testing only; do not use this command to run
# the Consul agent in production.
sudo consul agent -dev

# In another terminal, start dnsmasq so Nomad-launched containers can resolve
# *.consul lookups via the Docker bridge address (see the dns stanza in
# nomad/learn-helper.hcl); everything else still goes to the devcontainer's
# normal upstream resolvers.
sudo dnsmasq --conf-dir=/etc/dnsmasq.d,.conf --no-daemon

# In another terminal, start a local Nomad dev agent from the project root
# Pass nomad/devcontainer.hcl to override faulty CPU detection inside containers
sudo nomad agent -dev -config=nomad/devcontainer.hcl -config=nomad/nomad.hcl

# Build the app image
docker build -t learn-helper:local .

# Consul UI is available at http://localhost:8500/
# Nomad UI is available at http://localhost:4646/
# Run Traefik (available at :80 inside the devcontainer, dashboard at http://localhost:8080/dashboard/)
# check the Ports tab in your devcontainer tooling (e.g. VS Code) for the host-side port numbers.
nomad job run nomad/traefik.hcl

# Run Postgres (must be running before the app; defaults match docker-compose: app/example/app)
# The static host_volume path declared in nomad/nomad.hcl was provisioned above.
# Publishes a static port on Nomad's default host network (the node's real,
# default-route interface) and registers it as the "postgres" Consul service,
# discoverable at postgres.service.consul:5432. In a real multi-node cluster
# this job file needs no changes: Postgres comes up on whichever node's real
# IP it's scheduled to, and Consul DNS hands that out to callers on any node.
nomad job run nomad/postgres.hcl

# Apply all pending Drizzle migrations to the Nomad Postgres database.
# Uses the "db_local" port from nomad/postgres.hcl (loopback-only, reachable
# from the Nomad host itself), so this one-off host-side command doesn't need
# to go through Consul DNS at all.
POSTGRES_URL=postgres://app:example@localhost:5432/app npm run migrations:up

# Run the app
# check the Ports tab in your devcontainer tooling (e.g. VS Code) for the host-side port numbers.
# .env's POSTGRES_URL must point at postgres://<user>:<password>@postgres.service.consul:5432/<db>,
# matching the user/password/db passed to postgres.hcl (defaults: app/example/app).
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
