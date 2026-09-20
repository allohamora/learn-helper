# Grafana Cloud (Terraform)

Manages Grafana Cloud resources via the
[`grafana/grafana`](https://registry.terraform.io/providers/grafana/grafana/latest) provider:
the OTLP ingestion connection Alloy ships cloudflared's metrics/logs to (see
`helm/README.md`'s Alloy section), the `Cloudflared Tunnel` dashboard, its 5 alert
rules, and the email contact point/notification policy that routes them. All of this
used to be set up by hand in the Grafana Cloud UI; now it's one `terraform apply`.

## Configure

The provider needs two separate credentials - a stack-level one (dashboards, alert
rules, folders, contact points, notification policies) and a portal-level one
(creating the OTLP access policy/token, and looking up the stack). Neither
substitutes for the other; both are one-time manual bootstrap steps, same as any
other root credential in an IaC setup.

1. Stack URL: on [grafana.com](https://grafana.com), open your organization and find your
   stack's card. The URL shown there (e.g. `https://yourorg.grafana.net`) is `grafana_url` -
   use the base URL, not a path like `/alerting`. Everything else (stack slug, region,
   Prometheus/Loki data source names) is derived from this at plan time - see the comments
   in `cloud.tf`/`dashboard.tf`.
2. Service account token (stack-level, `grafana_auth`): launch that Grafana instance, then
   Administration > Users and access > Service accounts > Add service account (role: Admin).
   On the created service account, Add service account token, then copy it immediately -
   Grafana only shows it once.
3. Access policy token (portal-level, `grafana_cloud_access_policy_token`): on
   [grafana.com](https://grafana.com), go to your organization's Administration > Access
   Policies > Create access policy, scope it to `accesspolicies:read`,
   `accesspolicies:write`, `accesspolicies:delete`, and `stacks:read`. Create a token from
   it and copy it immediately.
4. Alert contact email (`alert_contact_email`): where the 5 cloudflared alert rules should
   email on fire.
5. Copy the example vars file and fill in all values:
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
terraform apply
```

After `apply`, fetch the OTLP endpoint and headers and copy them into
`helm/values.yaml`'s `alloy.env` - see `helm/README.md`'s Alloy section. Each command
below prints a ready-to-paste `env:` line:

```bash
# Not a Terraform output, so it never shows up in plan/apply - fetched on demand instead:
echo "OTEL_EXPORTER_OTLP_ENDPOINT: $(echo '"${data.grafana_cloud_stack.this.otlp_url}/otlp"' | terraform console | tr -d '"')"

# Has to be a real (sensitive) output - terraform console can't unmask a sensitive value:
echo "OTEL_EXPORTER_OTLP_HEADERS: '$(terraform output -raw otel_exporter_otlp_headers)'"
```
