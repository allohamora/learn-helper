---
name: execute-plan
description: Execute an existing plan in .plans/<slug>.md and keep progress updated.
compatibility: opencode
---

## What I do

- Open the relevant plan file in `.plans/` and review it end-to-end.
- Translate the next unchecked steps into concrete edits and execute them.
- Update checkboxes (`[x]`/`[ ]`) as work completes and keep notes current.
- Follow validation steps and record results in the plan.
- Ask blocking questions with the `question` tool, recommending a default.

## When to use me

Use when a plan already exists and the task is to implement it.

## Rules

- Treat the plan as the source of truth; do not skip phases without documenting the decision.
- Work top-to-bottom by phase; keep focus on the current phase.
- If scope changes, update the plan first, then proceed.
- Add new steps to the most relevant phase and keep them concise.
- Keep the `Notes` and `Open Questions` sections accurate.

## Execution pattern

1. Read the plan file, identify the current phase, and list the next steps to run.
2. Make the changes described by those steps.
3. Update the plan checkboxes and notes.
4. Run validations and log results.
5. Report progress and blockers.
