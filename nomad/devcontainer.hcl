client {
  # Override CPU detection - a devcontainer reports 0 MHz
  cpu_total_compute = 10000

  # Nomad dev mode defaults to loopback; use the devcontainer's primary
  # interface so allocations register addresses reachable by other containers.
  network_interface = "eth0"
}
