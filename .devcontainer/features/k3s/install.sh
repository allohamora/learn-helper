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

# Install Helm via the official installer
curl -fsSL https://raw.githubusercontent.com/helm/helm/main/scripts/get-helm-4 | bash

# Install k9s, matching the container's architecture
K9S_VERSION="$(curl -s https://api.github.com/repos/derailed/k9s/releases/latest | grep '"tag_name"' | cut -d '"' -f 4)"
curl -fsSL -o /tmp/k9s.tar.gz "https://github.com/derailed/k9s/releases/download/${K9S_VERSION}/k9s_Linux_${ARCH}.tar.gz"
tar -xzf /tmp/k9s.tar.gz -C /tmp k9s
install -m 0755 /tmp/k9s /usr/local/bin/k9s
rm -f /tmp/k9s.tar.gz /tmp/k9s

# Verify installations
kubectl version --client
k3d version
helm version
k9s version
