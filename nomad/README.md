# Running Nomad inside devcontainers

```bash
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
# The host_volume path (nomad/nomad.hcl) must exist on the host before the first run, e.g.:
# sudo mkdir -p /opt/nomad/volumes/postgres-data
nomad job run nomad/postgres.hcl

# Run the app
# check the Ports tab in your devcontainer tooling (e.g. VS Code) for the host-side port numbers.
# Note: we are making localhost as host, so 127.0.0.1 will not be working here, it should be localhost.
# The app's POSTGRES_URL in .env should point at postgres://app:example@localhost:5432/app,
# matching Postgres's loopback host_network binding on this same single-node host.
nomad job run -var="image=learn-helper:local" -var="env=$(cat .env)" nomad/learn-helper.hcl

# Stop the jobs
nomad job stop learn-helper
nomad job stop postgres
nomad job stop traefik
```
