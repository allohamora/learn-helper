job "traefik" {
  datacenters = ["dc1"]
  type        = "system"

  group "traefik" {
    network {
      port "http" {
        static = 80
      }
      port "dashboard" {
        static = 8080
      }
    }

    task "traefik" {
      driver = "docker"

      logs {
        max_files     = 5
        max_file_size = 5
      }

      config {
        image        = "traefik:v3.7.9"
        network_mode = "host"
        args = [
          "--api.insecure=true",
          "--api.dashboard=true",
          "--providers.consulcatalog=true",
          "--providers.consulcatalog.exposedByDefault=false",
          "--providers.consulcatalog.watch=true",
          "--entrypoints.web.address=:${NOMAD_PORT_http}"
        ]
      }

      resources {
        cpu    = 500
        memory = 512
      }
    }
  }
}
