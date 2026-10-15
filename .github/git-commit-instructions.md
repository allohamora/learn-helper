# Conventional Commits

Use `type(scope): subject` for commit messages.

- Use one of these types, picked by the commit's main purpose. Supporting work (refactors, tests, docs, etc.) stays in the same commit, e.g. a new feature with refactors and tests is `feat`. Unrelated changes get their own commit.
  - `feat`: new app behavior.
  - `fix`: app bug fix.
  - `perf`: app performance improvement.
  - `refactor`: app code restructuring with no behavior change.
  - `style`: app code formatting only.
  - `ci`: any infrastructure or CI/CD change (`.github/workflows`, `helm/`, `terraform/`, etc.).
  - `build`: build system or dependencies.
  - `test`: tests only.
  - `docs`: docs only.
  - `chore`: anything else, e.g. repo tooling and config.
  - `revert`: reverts a previous commit.
- Scope: only in a monorepo, and only when the change touches exactly one workspace package. Use its directory name, read from the repo's workspace config, never guessed. Otherwise no scope.
- Subject: lowercase, imperative mood, starts with a verb, no trailing period.
- Body: optional, blank line after the subject. Add one only when the _why_ isn't obvious from the subject.
- Breaking changes: `!` before the colon and/or a `BREAKING CHANGE: <description>` footer.
- Footer: `Co-Authored-By: <agent name> <agent email>`, the agent's own, not the user's.
- Keep every line of the message (header, body and footer) within 100 characters.
- Use simple, concise language.
