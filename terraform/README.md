# Grafana Cloud (Terraform)

Manages Grafana Cloud resources (dashboards, alerts, etc.) via the
[`grafana/grafana`](https://registry.terraform.io/providers/grafana/grafana/latest) provider.

## Configure

1. Stack URL: on [grafana.com](https://grafana.com), open your organization and find your
   stack's card. The URL shown there (e.g. `https://yourorg.grafana.net`) is `grafana_url` -
   use the base URL, not a path like `/alerting`.
2. Service account token: launch that Grafana instance, then Administration > Users and
   access > Service accounts > Add service account (role: Admin). On the created service
   account, Add service account token, then copy it immediately - Grafana only shows it
   once.
3. Copy the example vars file and fill in both values:
   ```bash
   cp terraform.tfvars.example terraform.tfvars
   ```

`terraform.tfvars` is gitignored - never commit it.

## Use

Requires the devcontainer to have been rebuilt after the `terraform` feature was added
(`.devcontainer/devcontainer.json`), so the CLI is available.

```bash
cd terraform
terraform init
terraform validate
terraform plan
```
