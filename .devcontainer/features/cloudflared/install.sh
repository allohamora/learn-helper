#!/bin/sh
set -eu

# Install cloudflared, matching the container's architecture (arm64 on Apple Silicon, amd64 on x86_64 CI/hosts)
ARCH="$(dpkg --print-architecture)"
curl -fsSL -o /tmp/cloudflared "https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-${ARCH}"
install -m 0755 /tmp/cloudflared /usr/local/bin/cloudflared
rm -f /tmp/cloudflared

# Verify installation
cloudflared --version
