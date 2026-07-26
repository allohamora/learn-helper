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
    count = 1

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
      port "db" {
        static       = 5432
        host_network = "loopback"
      }
    }

    service {
      name     = "postgres"
      provider = "nomad"
      port     = "db"

      check {
        type     = "tcp"
        interval = "10s"
        timeout  = "5s"
      }
    }

    task "postgres" {
      driver = "docker"

      config {
        image = var.image
        ports = ["db"]
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
