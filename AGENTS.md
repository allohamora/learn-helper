# Instructions

- Don't read `.env`, `terraform/terraform.tfvars`, `helm/values.yaml`, or other files with secrets. If I need a value from one, ask the user first instead of reading it.
- Don't make code changes (edits, file writes) until the user explicitly asks for the change. Investigate and present findings/options first, and wait for confirmation before editing.
- Use Conventional Commits for commit messages: `type: subject`.
  - Types: `feat`, `fix`, `refactor`, `test`, `chore`, `docs`, `style`, `perf`, `build`, `ci`, `revert`. Pick the type based on what actually changed.
  - Scope: in a monorepo (multiple apps/packages, e.g. workspaces in package.json, or an apps/ or packages/ layout), add a scope for the app/lib the change touches, e.g. `fix(api): correct pagination offset`. In a single-app repo, skip the scope, e.g. `fix: correct pagination offset`.
  - Subject: lowercase, imperative mood, starts with a verb, no trailing period.
  - Body: optional, blank line after the subject. Add one when the _why_ isn't obvious from the subject alone, e.g. the reasoning behind a non-obvious change, a tradeoff, or context a reviewer would otherwise have to ask for. Skip it for small, self-explanatory changes.
  - Breaking changes: add a `!` before the colon (e.g. `feat!: subject`) and/or a `BREAKING CHANGE: <description>` footer explaining the break.
- Before every commit, show the proposed commit message and ask for confirmation (e.g. "Ready to commit as `<message>`. Go ahead?"). On a yes, commit and push in that same step - don't ask again separately for the push.
- Don't create git commits or push until the user explicitly asks for it.
- Use simple, concise language, e.g. answers, code, commit messages, PR descriptions, comments.
- Don't write comments that just restate what the code does. They add noise and go stale as the code changes. Only comment where it adds real value: explain why, not what, e.g. a non-obvious reason, a tradeoff, a workaround, a gotcha.
