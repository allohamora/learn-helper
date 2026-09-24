# Instructions

- Don't read `.env`, `terraform/terraform.tfvars`, `helm/values.yaml`, or other files with secrets. If I need a value from one, ask the user first instead of reading it.
- Don't make code changes (edits, file writes) until the user explicitly asks for the change. Investigate and present findings/options first, and wait for confirmation before editing.
- Use Conventional Commits for commit messages: `type(scope): subject`.
  - Types: `feat`, `fix`, `refactor`, `test`, `chore`, `docs`, `style`, `perf`, `build`, `ci`, `revert`. `feat`/`fix` are for what a user of the app experiences.
  - Scope: the touched package's directory name, taken from the repo's real workspace list — never guessed or reused from a past commit. Use one only when the change touches exactly one workspace package; otherwise (multiple packages, or a path outside the workspace list) skip the scope and commit as one change.
  - Subject: lowercase, imperative mood, starts with a verb, no trailing period.
  - Body: optional, blank line after the subject. Add one when the _why_ isn't obvious from the subject alone, e.g. the reasoning behind a non-obvious change, a tradeoff, or context a reviewer would otherwise have to ask for. Skip it for small, self-explanatory changes.
  - Breaking changes: add a `!` before the colon (e.g. `feat!: subject`) and/or a `BREAKING CHANGE: <description>` footer explaining the break.
  - Add a `Co-Authored-By: <agent name> <agent email>` footer using the agent's own name and email, not the user's.
- Before every commit, show the proposed commit message and ask for confirmation (e.g. "Ready to commit as `<message>`. Go ahead?"). On a yes, commit and push in that same step - don't ask again separately for the push.
- Don't create git commits or push until the user explicitly asks for it.
- Use simple, concise language, e.g. answers, code, commit messages, PR descriptions, comments.
- Default to no comments. Before writing one, check whether the surrounding code - names, types, structure - already answers the question. Write it only if it doesn't, and skipping it would risk a real mistake. The same test applies to a comment picked up from elsewhere (a reference file, a plan, another agent's output) - it earns its place here by passing this test itself, not because the source had it.
- Before considering a change done, run the relevant checks for what you touched (e.g. typecheck, lint, tests, build), and fix any failures.
- When a change affects something documented elsewhere (e.g. `docs/`, `README.md`), update that documentation in the same change. Don't add documentation for things that didn't change.
- If you notice code changed since you last looked at it, in a way that no linter/formatter would produce (e.g. removed comments, edited logic, renamed vars), assume the user made a manual edit, and factor that into your next decisions accordingly.
