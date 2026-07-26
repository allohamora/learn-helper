# Full configuration options can be found at https://developer.hashicorp.com/nomad/docs/configuration

data_dir  = "/opt/nomad/data"
bind_addr = "0.0.0.0"

server {
  enabled          = true
  bootstrap_expect = 1
}

client {
  enabled = true
  servers = ["127.0.0.1"]

  # With each one-task allocation retaining 5 files × 5 MB × 2 streams,
  # 50 allocations can retain approximately 2.5 GB of task logs.
  gc_max_allocs = 50

  # Bind loopback to localhost
  host_network "loopback" {
    cidr = "127.0.0.1/32"
  }

  # Persistent storage for the postgres job's data directory
  host_volume "postgres-data" {
    path      = "/opt/nomad/volumes/postgres-data"
    read_only = false
  }
}

# Allow docker driver to mount volumes for the app
plugin "docker" {
  config {
    volumes {
      enabled = true
    }
  }
}
