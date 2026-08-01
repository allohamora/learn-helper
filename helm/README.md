# Running Kubernetes (k3s) inside devcontainers

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

# Admin panel: browse and manage the cluster's resources interactively.
k9s -n learn-helper

# Update: deploy a new app build without editing values.yaml.
docker build -t learn-helper:v2 .
k3d image import learn-helper:v2 -c learn-helper

helm upgrade learn-helper helm \
  --namespace learn-helper \
  --atomic \
  --wait \
  --timeout 10m \
  --set-string app.image=learn-helper:v2

# Seed the database manually (one-off, run against the live app pod).
kubectl exec -n learn-helper deploy/app -- npm run vocabulary:seed

# Remove the release. The postgres-data PVC is kept (helm.sh/resource-policy: keep),
# so postgresql data survives this step.
helm uninstall learn-helper --namespace learn-helper

# Remove the postgres data volume. This permanently deletes the database - only
# run it once you're sure you no longer need the data.
kubectl delete pvc postgres-data --namespace learn-helper

# Remove the now-empty namespace.
kubectl delete namespace learn-helper

# Delete the local cluster.
k3d cluster delete learn-helper
```

# Remote deployment via SSH over Cloudflare Zero Trust

my steps:

1. go to cloudflare dashboard, zero trust, networks, tunnels and mesh, create a tunnel, choose cloudflared, name it, then use arm64 linux install commands, and install to run always, create ssh route for localhost:22
2. go to applications, add an application, self-hosted, public dsn, fill the public hostname with the ssh route from step 1, add a policy to allow your email address, make allow me policy and set there include emails my email and save, then you will be able to do `ssh -o ProxyCommand="cloudflared access ssh --hostname %h" user@url`
3. go to service credentials, service tokens, add a token, copy the client id and client secret, then back to applications, edit the application you created in step 2, go to policies, and add policy for this service token, with action: service auth instead of allow.
4. create on github production environment, and add `CLOUDFLARE_ACCESS_CLIENT_ID` and `CLOUDFLARE_ACCESS_CLIENT_SECRET`
5. install k3s from the official site sh script
6. make kubectl usage without sudo/root
7. install helm from the official site by ubuntu installation
8. install k9s via releases on github
9. install docker via the official site
10. setup app zero trust tunnel, select docker, copy token, make http + traefik.kube-system.svc.cluster.local:80
11. make git clone of the repo, and deploy the initial app

These steps set up SSH access to a remote server through Cloudflare Zero Trust
(so port 22 never has to be open to the internet), then install k3s, kubectl,
helm and k9s on that server. Once connected, every command below is run
directly on the server, the same way `scripts/backup.sh` connects and runs
commands over SSH.

```bash
# 1. Create a Zero Trust team (one-time, per Cloudflare account).
# Go to https://one.dash.cloudflare.com and pick a team name, e.g. "your-team".
# This gives you https://your-team.cloudflareaccess.com.

# 2. Create a tunnel and route SSH through it.
# Zero Trust dashboard > Networks > Tunnels > Create a tunnel > Cloudflared,
# name it e.g. "learn-helper-ssh". It shows an install command for the token -
# run the equivalent of this on the remote server to install cloudflared as a
# system service:
curl -L --output cloudflared.deb \
  https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-amd64.deb
sudo dpkg -i cloudflared.deb
sudo cloudflared service install <TUNNEL_TOKEN>

# Still in the tunnel's "Public Hostname" tab, add a route:
# Subdomain "ssh", Domain "your-domain.com", Service type "SSH", URL "localhost:22".

# 3. Protect that hostname with an Access application.
# Zero Trust dashboard > Access > Applications > Add an application > Self-hosted.
# Application domain: ssh.your-domain.com (same hostname as step 2).
# Add a policy, e.g. Allow -> Include -> Emails -> your email address(es).

# 4. On your local machine (devcontainer/laptop), install the cloudflared
# client and point SSH at it via ~/.ssh/config:
#   Host learn-helper-server
#     HostName ssh.your-domain.com
#     User <your-ssh-user>
#     ProxyCommand cloudflared access ssh --hostname %h
cloudflared access login ssh.your-domain.com
ssh learn-helper-server

# --- everything below runs on the remote server, after the ssh command above ---

# 5. Install k3s. This also drops a kubectl binary and writes a kubeconfig
# readable by root at /etc/rancher/k3s/k3s.yaml.
curl -sfL https://get.k3s.io | sh -

# Make kubectl usable without sudo/root.
mkdir -p ~/.kube
sudo cp /etc/rancher/k3s/k3s.yaml ~/.kube/config
sudo chown "$(id -u)":"$(id -g)" ~/.kube/config
echo 'export KUBECONFIG=~/.kube/config' >> ~/.bashrc

# 6. Install helm.
curl https://raw.githubusercontent.com/helm/helm/main/scripts/get-helm-3 | bash

# 7. Install k9s.
K9S_VERSION=$(curl -s https://api.github.com/repos/derailed/k9s/releases/latest | grep tag_name | cut -d '"' -f4)
curl -sL "https://github.com/derailed/k9s/releases/download/${K9S_VERSION}/k9s_Linux_amd64.tar.gz" \
  | sudo tar xz -C /usr/local/bin k9s

# 8. Install docker, used below to build the app image.
curl -fsSL https://get.docker.com | sudo sh
sudo usermod -aG docker "$(whoami)"
newgrp docker

# 9. Get the code and configure values.
git clone <repo-url> ~/projects/learn-helper
cd ~/projects/learn-helper
cp helm/values.example.yaml helm/values.yaml
# Edit helm/values.yaml: set domain, cloudflared.enabled/env (app ingress tunnel,
# separate from the SSH tunnel above), and the app/postgres secrets.

# 10. Build the app image and import it into k3s's containerd. k3s has no
# equivalent of `k3d image import`, so this replaces that step from the
# devcontainer flow above.
docker build -t learn-helper:0.0.1 .
docker save learn-helper:0.0.1 | sudo k3s ctr images import -

# 11. Install: deploy the complete stack for the first time.
helm upgrade --install learn-helper helm \
  --namespace learn-helper \
  --create-namespace \
  --atomic \
  --wait \
  --timeout 10m \
  --set-string app.image=learn-helper:0.0.1

# Admin panel: browse and manage the cluster's resources interactively.
k9s -n learn-helper

# Update: build+import a new tag, then point the release at it.
docker build -t learn-helper:0.0.2 .
docker save learn-helper:0.0.2 | sudo k3s ctr images import -
helm upgrade learn-helper helm \
  --namespace learn-helper \
  --atomic \
  --wait \
  --timeout 10m \
  --set-string app.image=learn-helper:0.0.2
```

# Database backups

```bash
# Back up the database to a local, timestamped, gzip-compressed SQL file.
kubectl exec -n learn-helper deploy/postgres -- \
  pg_dump -U app -d test | gzip > "backup-$(date +"%Y-%m-%d").sql.gz"

# Restore the database from a backup made with the command above. Scale the
# app down first so nothing is writing mid-restore, then scale it back up.
kubectl scale -n learn-helper deploy/app --replicas=0
gunzip -c backup-2026-08-01.sql.gz | kubectl exec -i -n learn-helper deploy/postgres -- psql -U app -d test
kubectl scale -n learn-helper deploy/app --replicas=1
```
