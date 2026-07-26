job "traefik" {
  datacenters = ["dc1"]
  type        = "system"

  group "traefik" {
    network {
      port "http" {
        static = 80
      }
      port "dashboard" {
        static       = 8080
        host_network = "loopback"
      }
    }

    task "traefik" {
      driver = "docker"

      config {
        image        = "traefik:v3.7.9"
        network_mode = "host"
        args = [
          "--api.insecure=true",
          "--api.dashboard=true",
          "--providers.nomad=true",
          "--providers.nomad.exposedByDefault=false",
          "--providers.nomad.watch=true",
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
