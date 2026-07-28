#!/bin/sh
set -eu

# Install kubectl, matching the container's architecture (arm64 on Apple Silicon, amd64 on x86_64 CI/hosts)
ARCH="$(dpkg --print-architecture)"
KUBECTL_VERSION="$(curl -L -s https://dl.k8s.io/release/stable.txt)"
curl -fsSL -o /tmp/kubectl "https://dl.k8s.io/release/${KUBECTL_VERSION}/bin/linux/${ARCH}/kubectl"
install -m 0755 /tmp/kubectl /usr/local/bin/kubectl
rm -f /tmp/kubectl

# Install k3d via the official installer (k3d does not bundle kubectl, hence the separate install above)
curl -s https://raw.githubusercontent.com/k3d-io/k3d/main/install.sh | bash

# Verify both installations
kubectl version --client
k3d version
