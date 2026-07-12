# Instructions

- Never read `.env` (or other credential/secret files). If a value from one is needed, ask the user first instead of reading it yourself.
- Do not make code changes (edits, file writes) until the user explicitly asks you to make the change. Investigate and present options/findings first, and wait for confirmation before editing.
- Use Conventional Commits for commit messages:
  - Format: `type: subject` — do not add a scope; this is a single-app repo, not a monorepo, so there's no natural scope to put there.
  - Allowed types: `feat`, `fix`, `refactor`, `test`, `chore`, `docs`, `style`, `perf`, `build`, `ci`, `revert`.
  - Subject: lowercase first word, imperative mood, starts with a verb (e.g. "add pagination to vocabulary list"), no trailing period.
  - Pick the type based on what actually changed, e.g. `test:` for test-only changes, `docs:` for docs-only, `fix:` for bug fixes, `feat:` for new features, `refactor:` for no-behavior-change restructuring.
  - Breaking changes: add a `!` before the colon (e.g. `feat!: subject`) and/or a `BREAKING CHANGE: <description>` footer explaining the break.
  - After creating a commit, output the full commit message to the user.
