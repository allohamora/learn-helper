# Conventional Commits

Use `type(scope): subject` for commit messages.

- Types: `feat`, `fix`, `refactor`, `test`, `chore`, `docs`, `style`, `perf`, `build`, `ci`, `revert`. Pick the type based on what actually changed.
- Scope: only in a monorepo (multiple apps/packages, e.g. workspaces in package.json, or an apps/ or packages/ layout) — add a scope matching the exact app/package directory name, e.g. `fix(api): correct pagination offset`. Never invent a scope from anything else (e.g. a feature, skill, or file name). In a single-app repo, always skip the scope, e.g. `fix: correct pagination offset`.
- Subject: lowercase, imperative mood, starts with a verb, no trailing period.
- Body: optional, blank line after the subject. Add one when the _why_ isn't obvious from the subject alone, e.g. the reasoning behind a non-obvious change, a tradeoff, or context a reviewer would otherwise have to ask for. Skip it for small, self-explanatory changes.
- Breaking changes: add a `!` before the colon (e.g. `feat!: subject`) and/or a `BREAKING CHANGE: <description>` footer explaining the break.
- Add yourself as a co-author with a `Co-Authored-By: <your name> <your email>` footer.
