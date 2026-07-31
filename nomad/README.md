# Running Nomad and Consul inside devcontainers

```bash
# Static host volumes are not created by Nomad. Provision this directory on every
# Nomad client node eligible to run Postgres before starting the Nomad client:
sudo install -d -m 0755 /opt/nomad/volumes/postgres-data

# In a separate terminal, start a local Consul dev agent before starting Nomad.
# Development mode is for local testing only; do not use this command to run
# the Consul agent in production.
sudo consul agent -dev

# The Consul devcontainer feature saves Docker's initial nameserver and starts
# dnsmasq automatically. The devcontainer sends all DNS queries to dnsmasq:
# *.consul queries go to the local Consul agent, while all other queries fall
# back to Docker's saved nameserver. Nomad allocations reach the same dnsmasq
# instance through the Docker bridge address configured in nomad/learn-helper.hcl.

# In another terminal, start a local Nomad dev agent from the project root
# Pass nomad/devcontainer.hcl to override faulty CPU detection inside containers
sudo nomad agent -dev -config=nomad/devcontainer.hcl -config=nomad/nomad.hcl

# Build the app image
docker build -t learn-helper:local .

# Consul UI is available at http://localhost:8500/
# Nomad UI is available at http://localhost:4646/
# Run Traefik (available at http://localhost:80/, dashboard at http://localhost:8080/dashboard/)
# check the Ports tab in your devcontainer tooling (e.g. VS Code) for the host-side port numbers.
nomad job run nomad/traefik.hcl

# Run Postgres (must be running before the app; defaults match docker-compose: app/example/app)
# The static host_volume path declared in nomad/nomad.hcl was provisioned above.
# Available from the host at localhost:5432 and registered as the "postgres"
# Consul service, discoverable by Nomad-launched containers at
# postgres.service.consul:5432.
nomad job run nomad/postgres.hcl

# Run the app
# The app applies pending Drizzle migrations on boot, safe with multiple
# allocations via an advisory lock (see runMigrations in db.service.ts).
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
