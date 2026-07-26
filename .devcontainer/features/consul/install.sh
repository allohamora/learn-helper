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

# Forward .consul lookups to Consul's DNS interface (127.0.0.1:8600, Consul's
# default DNS port since the dev agent in nomad/README.md is started with no
# non-default flags); dnsmasq keeps using the devcontainer's existing
# resolvers (from /etc/resolv.conf) for everything else. Run via
# `sudo dnsmasq --conf-dir=/etc/dnsmasq.d,.conf` (see nomad/README.md) -
# there's no init system in this container to run it as a managed service.
echo "server=/consul/127.0.0.1#8600" > /etc/dnsmasq.d/10-consul.conf
