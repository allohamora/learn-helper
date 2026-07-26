variable "image" {
  type    = string
  default = "postgres:18.4-alpine"
}

variable "user" {
  type    = string
  default = "app"
}

variable "password" {
  type    = string
  default = "example"
}

variable "db" {
  type    = string
  default = "app"
}

job "postgres" {
  datacenters = ["dc1"]
  type        = "service"

  group "postgres" {
    count          = 1
    shutdown_delay = "10s"

    restart {
      attempts = 3
      interval = "5m"
      delay    = "15s"
      mode     = "fail"
    }

    # Backed by the "postgres-data" host_volume declared in nomad/nomad.hcl, i.e. a plain
    # directory on the host, outside Nomad's own data_dir/allocation bookkeeping. Chosen over
    # ephemeral_disk (sticky/migrate) so the data survives things like reinstalling Nomad or
    # wiping its data_dir, since it was never tied to Nomad's own state to begin with.
    volume "postgres-data" {
      type      = "host"
      source    = "postgres-data"
      read_only = false
    }

    network {
      # Used by other Nomad allocations, discovered via the "postgres" service below.
      port "db_service" {
        to           = 5432
        host_network = "private"
      }

      # Used only from the Nomad host itself, e.g. through an SSH tunnel for admin access.
      # Not registered as the Nomad service, since another allocation can't reach the host
      # through its own 127.0.0.1.
      port "db_local" {
        static       = 5432
        host_network = "loopback"
      }
    }

    service {
      name     = "postgres"
      provider = "nomad"
      port     = "db_service"

      check {
        type     = "tcp"
        port     = "db_service"
        interval = "10s"
        timeout  = "5s"
      }
    }

    task "postgres" {
      driver = "docker"

      logs {
        max_files     = 5
        max_file_size = 5
      }

      config {
        image = var.image
        ports = ["db_service", "db_local"]
      }

      volume_mount {
        volume      = "postgres-data"
        destination = "/var/lib/postgresql/data"
      }

      env {
        POSTGRES_USER     = var.user
        POSTGRES_PASSWORD = var.password
        POSTGRES_DB       = var.db
        PGDATA            = "/var/lib/postgresql/data/pgdata"
      }

      resources {
        cpu    = 500
        memory = 512
      }
    }
  }
}
