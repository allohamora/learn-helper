# Instructions

- Don't read `.env`, `terraform/terraform.tfvars`, `helm/values.yaml`, or other files with secrets. If I need a value from one, ask the user first instead of reading it.
- Don't make code changes (edits, file writes) until the user explicitly asks for the change. Investigate and present findings/options first, and wait for confirmation before editing.
- Use Conventional Commits for commit messages: `type: subject`.
  - Types: `feat`, `fix`, `refactor`, `test`, `chore`, `docs`, `style`, `perf`, `build`, `ci`, `revert`. Pick the type based on what actually changed.
  - Scope: in a monorepo (multiple apps/packages, e.g. workspaces in package.json, or an apps/ or packages/ layout), add a scope for the app/lib the change touches, e.g. `fix(api): correct pagination offset`. In a single-app repo, skip the scope, e.g. `fix: correct pagination offset`.
  - Subject: lowercase, imperative mood, starts with a verb, no trailing period.
  - Breaking changes: add a `!` before the colon (e.g. `feat!: subject`) and/or a `BREAKING CHANGE: <description>` footer explaining the break.
- Before committing, show the proposed commit message and ask for confirmation (e.g. "Ready to commit as `<message>`. Go ahead?") - wait for a yes, then commit and push.
- Don't create git commits or push until the user explicitly asks for it.
