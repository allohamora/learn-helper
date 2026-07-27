#!/bin/sh
set -eu

# Provide split DNS without discarding Docker's resolver:
# .consul queries go through dnsmasq to Consul, while all others use Docker DNS.
runtime_dir=/run/dnsmasq
docker_resolv="${runtime_dir}/upstream-resolv.conf"
temporary_docker_resolv="${docker_resolv}.tmp"

# Run as root because port 53 and /etc/resolv.conf require elevated permissions.
if [ "$(id -u)" -ne 0 ]; then
    exec sudo "$0" "$@"
fi

# Create the directory used for dnsmasq runtime files.
mkdir -p "${runtime_dir}"

# On the first start, copy Docker's initial resolver into dnsmasq's upstream
# resolver file. Exclude loopback nameservers so dnsmasq never forwards queries
# back to itself, but preserve search domains and resolver options. dnsmasq
# continues using this file after /etc/resolv.conf is changed to use dnsmasq.
# AWK succeeds only when it finds a Docker nameserver.
if awk '
    $1 == "nameserver" && $2 !~ /^127\./ && $2 != "::1" {
        found = 1
        print
        next
    }

    $1 == "search" || $1 == "options" {
        print
    }

    END {
        exit !found
    }
' /etc/resolv.conf > "${temporary_docker_resolv}"; then
    # Docker DNS was found, so store the temporary file as the saved resolver.
    mv "${temporary_docker_resolv}" "${docker_resolv}"
else
    # No Docker nameserver was found. Delete the temporary file, which may be
    # empty or contain only search domains and resolver options, and reuse a
    # resolver saved during an earlier start.
    rm -f "${temporary_docker_resolv}"
fi

# Verify that dnsmasq has a saved Docker nameserver for non-Consul queries.
if [ ! -s "${docker_resolv}" ]; then
    echo "Consul DNS setup could not determine Docker's upstream resolver." >&2
    exit 1
fi

# Start dnsmasq on port 53. Its configuration sends .consul queries to Consul
# and all other queries to the saved Docker nameserver.
dnsmasq \
    --conf-dir=/etc/dnsmasq.d \
    --pid-file="${runtime_dir}/consul-dns.pid"

# Build a resolver configuration that sends all DNS queries to dnsmasq while
# preserving Docker's search domains and resolver options.
new_resolv="$(
    echo "# Managed at runtime by the Consul devcontainer feature."
    echo "nameserver 127.0.0.1"
    awk '$1 == "search" || $1 == "options" { print }' "${docker_resolv}"
)"

# If necessary, point applications to dnsmasq by updating /etc/resolv.conf.
if [ "$(cat /etc/resolv.conf)" != "${new_resolv}" ]; then
    # Docker bind-mounts the file, so overwrite its contents without replacing it.
    printf '%s\n' "${new_resolv}" > /etc/resolv.conf
fi
