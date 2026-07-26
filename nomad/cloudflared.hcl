variable "token" {
  type        = string
  description = "Cloudflare Tunnel token, created via the Zero Trust dashboard (Networks > Tunnels > Create a tunnel > Docker)"
}

job "cloudflared" {
  datacenters = ["dc1"]
  type        = "system"

  group "cloudflared" {
    restart {
      attempts = 3
      interval = "5m"
      delay    = "15s"
      mode     = "fail"
    }

    task "cloudflared" {
      driver = "docker"

      logs {
        max_files     = 5
        max_file_size = 5
      }

      config {
        image        = "cloudflare/cloudflared:2026.7.3"
        network_mode = "host"
        args = [
          "tunnel",
          "--no-autoupdate",
          "run"
        ]
      }

      env {
        TUNNEL_TOKEN = var.token
      }

      resources {
        cpu    = 100
        memory = 128
      }
    }
  }
}
