#!/bin/sh
set -eu

# Install base dependencies
apt-get update
apt-get install -y --no-install-recommends ca-certificates coreutils dnsmasq dnsutils gpg lsb-release wget

# Add the HashiCorp GPG key
wget -O- https://apt.releases.hashicorp.com/gpg \
    | gpg --dearmor --yes -o /usr/share/keyrings/hashicorp-archive-keyring.gpg

# Add the HashiCorp apt repository
echo "deb [signed-by=/usr/share/keyrings/hashicorp-archive-keyring.gpg] https://apt.releases.hashicorp.com $(lsb_release -cs) main" \
    > /etc/apt/sources.list.d/hashicorp.list

# Install Consul
apt-get update
apt-get install -y --no-install-recommends consul
rm -rf /var/lib/apt/lists/*

# Create the Consul data directory
mkdir -p /opt/consul/data

# Configure split DNS for the devcontainer and Docker allocations: send .consul
# queries to the local Consul agent and fall back to Docker's saved nameserver
# for all other queries.
cat > /etc/dnsmasq.d/10-consul.conf <<'EOF'
server=/consul/127.0.0.1#8600
resolv-file=/run/dnsmasq/upstream-resolv.conf
local-service
EOF

# Configure the Docker-in-Docker daemon to use dnsmasq for all containers.
# Pin the default bridge address so the DNS server remains reachable at a
# stable address across devcontainer rebuilds.
mkdir -p /etc/docker
cat > /etc/docker/daemon.json <<'EOF'
{
  "bip": "172.18.0.1/24",
  "dns": ["172.18.0.1"]
}
EOF

# Install the runtime entrypoint as an executable in a stable system location.
install -m 0755 dns-init.sh /usr/local/share/consul-dns-init.sh
