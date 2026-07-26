variable "image" {
  type    = string
  default = "learn-helper:latest"
}

variable "env" {
  type        = string
  description = "Contents of the .env file, passed via $(cat .env)"
}

variable "domain" {
  type    = string
  default = "localhost"
}

job "learn-helper" {
  datacenters = ["dc1"]
  type        = "service"

  # Rolling zero-downtime update via canary:
  # - Starts 1 new allocation alongside the existing one
  # - Waits for the new allocation to stay healthy for min_healthy_time
  # - Promotes automatically once healthy (auto_promote = true for CI/CD)
  # - Auto-reverts if healthy_deadline is exceeded, keeping old allocation serving
  update {
    max_parallel      = 1
    canary            = 1
    min_healthy_time  = "30s"
    healthy_deadline  = "5m"
    progress_deadline = "10m"
    auto_revert       = true
    auto_promote      = true
  }

  group "learn-helper" {
    count = 1

    restart {
      attempts = 3
      interval = "5m"
      delay    = "15s"
      mode     = "fail"
    }

    network {
      port "http" {
        to           = 3000
        host_network = "loopback"
      }
    }

    service {
      name     = "learn-helper"
      provider = "nomad"
      port     = "http"

      check {
        type     = "http"
        path     = "/"
        interval = "10s"
        timeout  = "5s"
      }

      tags = [
        "traefik.enable=true",

        # Security headers
        # X-Content-Type-Options: nosniff — prevents browsers from MIME-sniffing the declared content type
        "traefik.http.middlewares.sec.headers.contenttypenosniff=true",
        # X-Frame-Options: DENY — blocks page embedding in any iframe, prevents clickjacking
        "traefik.http.middlewares.sec.headers.framedeny=true",
        # Referrer-Policy: strict-origin-when-cross-origin — cross-origin requests (e.g. loading YouTube) get the bare origin as Referer never the full path; same-origin requests get the full URL; nothing is sent on HTTPS→HTTP downgrades
        "traefik.http.middlewares.sec.headers.referrerpolicy=strict-origin-when-cross-origin",
        # Strict-Transport-Security: max-age=31536000 (1 year) — forces HTTPS, prevents downgrade attacks
        "traefik.http.middlewares.sec.headers.stsseconds=31536000",

        # Rate limiting — bucket holds 100 requests; refills 50 per second; requests are blocked only when the bucket is empty
        "traefik.http.middlewares.ratelimit.ratelimit.average=50",
        "traefik.http.middlewares.ratelimit.ratelimit.burst=100",

        # Compression — gzip, brotli, zstd negotiated via Accept-Encoding; min 1 KB
        "traefik.http.middlewares.compress.compress=true",

        # ── HTML pages — allow bfcache but force revalidation ─────────────────
        # Priority 1 ensures all specific routers below (priority ≥ 15) take precedence.
        "traefik.http.middlewares.cache-html.headers.customResponseHeaders.Cache-Control=private, max-age=0, must-revalidate",
        "traefik.http.routers.learn-helper.rule=Host(`${var.domain}`)",
        "traefik.http.routers.learn-helper.entrypoints=web",
        "traefik.http.routers.learn-helper.middlewares=sec,ratelimit,compress,cache-html",
        "traefik.http.routers.learn-helper.priority=1",

        # ── /api/ — no cache header (excluded from the HTML catch-all below) ───
        "traefik.http.routers.learn-helper-api.rule=Host(`${var.domain}`) && PathPrefix(`/api/`)",
        "traefik.http.routers.learn-helper-api.entrypoints=web",
        "traefik.http.routers.learn-helper-api.middlewares=sec,ratelimit,compress",
        "traefik.http.routers.learn-helper-api.priority=20",

        # ── /favicon.ico — 1-day ──────────────────────────────────────────────
        "traefik.http.middlewares.cache-favicon.headers.customResponseHeaders.Cache-Control=public, max-age=86400",
        "traefik.http.middlewares.cache-favicon.headers.customResponseHeaders.Vary=Accept-Encoding",
        "traefik.http.routers.learn-helper-favicon.rule=Host(`${var.domain}`) && Path(`/favicon.ico`)",
        "traefik.http.routers.learn-helper-favicon.entrypoints=web",
        "traefik.http.routers.learn-helper-favicon.middlewares=sec,ratelimit,compress,cache-favicon",
        "traefik.http.routers.learn-helper-favicon.priority=25",

        # ── image/media files — 7-day with stale fallback ─────────────────────
        # Priority 15 ensures /favicon.ico (priority 25) wins over the .ico match here.
        "traefik.http.middlewares.cache-media.headers.customResponseHeaders.Cache-Control=public, max-age=604800, stale-while-revalidate=600, stale-if-error=86400",
        "traefik.http.middlewares.cache-media.headers.customResponseHeaders.Vary=Accept-Encoding",
        "traefik.http.routers.learn-helper-media.rule=Host(`${var.domain}`) && PathRegexp(`(?i)\\.(png|jpe?g|gif|svg|webp|avif|ico)$`)",
        "traefik.http.routers.learn-helper-media.entrypoints=web",
        "traefik.http.routers.learn-helper-media.middlewares=sec,ratelimit,compress,cache-media",
        "traefik.http.routers.learn-helper-media.priority=15",
      ]
    }

    task "app" {
      driver = "docker"

      config {
        image = var.image
        ports = ["http"]
      }

      template {
        data        = var.env
        destination = "secrets/.env"
        env         = true
        change_mode = "restart"
      }

      resources {
        cpu    = 500
        memory = 512
      }
    }
  }
}
