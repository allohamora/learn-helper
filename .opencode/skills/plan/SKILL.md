---
name: plan
description: Create a clear plan in .plans/<slug>.md with phases, scope, and validation.
compatibility: opencode
---

## What I do

- Create or update a plan file at `.plans/<slug>.md` before making changes.
- Capture current behavior, constraints, key files, and desired outcome.
- Break work into meaningful, verifiable steps grouped by phase.
- Include validation notes and any open questions.
- Record risks, assumptions, and decisions so context persists.
- Ask open questions using the `question` tool when clarification is needed.

## When to use me

Use for tasks with 3+ steps, multi-file changes, refactors, or when asked to make a plan. Skip for trivial or single-step requests.

## Quality bar

- Keep steps short, concrete, and testable.
- Avoid filler like "do the thing" or vague outcomes.
- Include non-goals when scope is ambiguous.
- Keep the plan focused: cover only what you intend to do.

## Rules

- Use kebab-case for `<slug>`.
- Use full paths in Context.
- Start each step with a verb and keep it concise.
- Phases are logical groupings; use as many as needed (not fixed to two).
- Use checkboxes (`[ ]`, `[x]`) to track progress.
- If scope changes, update the plan and note the decision.
- If the repo has a plan directory convention, follow it instead.
- Add a validation phase when applicable.
- End with an Open Questions section (use "None" if empty).
- When open questions remain, ask them with the `question` tool using open-ended wording and a recommended default.

## Good vs. weak examples

Good steps:

- Add CLI entry with file args
- Parse Markdown via CommonMark
- Apply semantic HTML template
- Handle code blocks, images, links
- Add error handling for invalid files

Weak steps:

- Create CLI tool
- Add Markdown parser
- Convert to HTML

## Plan template

```md
# Plan: <title>

## Overview

<What changes and why it matters.>

## Context

<Current behavior, constraints, dependencies, etc.>

## Audit

<Current inventory and findings, relevant files, key identifiers, etc.>

## Scope

<Goals, non-goals, requirements, edge cases, and UX notes.>

## Plan

### Phase 1: <name>

- [ ] <Step 1>
- [ ] <Step 2>

### Phase 2: <name>

- [ ] <Step 3>
- [ ] <Step 4>

## Notes

<Notes, references, links, resources, decisions, discoveries, updates.>

## Open Questions

<None or list of questions.>
```
