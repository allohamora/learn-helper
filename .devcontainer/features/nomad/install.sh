#!/bin/sh
set -eu

# Install base dependencies
apt-get update
apt-get install -y --no-install-recommends ca-certificates coreutils gpg lsb-release wget

# Add the HashiCorp GPG key
wget -O- https://apt.releases.hashicorp.com/gpg \
    | gpg --dearmor --yes -o /usr/share/keyrings/hashicorp-archive-keyring.gpg

# Add the HashiCorp apt repository
echo "deb [signed-by=/usr/share/keyrings/hashicorp-archive-keyring.gpg] https://apt.releases.hashicorp.com $(lsb_release -cs) main" \
    > /etc/apt/sources.list.d/hashicorp.list

# Install Nomad
apt-get update
apt-get install -y --no-install-recommends nomad
rm -rf /var/lib/apt/lists/*

# Create the Nomad data directory
mkdir -p /opt/nomad/data
