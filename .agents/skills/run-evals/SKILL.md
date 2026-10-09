---
name: run-evals
description: Run the evals one at a time - fix the prompt on failures and run again until they are stable.
---

## What I do

- Run only the evals related to the change, unless the author asks for more.
- Run the evals one at a time, each run as its own command, never in a loop or repeat construct (`for`, `while`, `seq`, `xargs`, `repeat`, `parallel`), even to re-run a single flaky test.

## Each run

- Save the full output to a temp file, so the result is not lost.
- Show how many passed, which failed and why, and the streak (e.g. `streak 2/5`), even on a failure.
- If all passed, add 1 to the streak.
- If something failed, reset the streak to 0.
- On failure, confirm and name the cause: the prompt, the code, a wrong test or judge statement, or something else.
- Say what I suggest.
- Make a change that fixes that cause.
- Run again only after that change, because a re-run with no change is a gamble, not a fix.
- Stop and sum up at 5 passes in a row, or the number the author asks for.

## Instructions

- Aim for stable evals and stable prompts.
- Never accept "it's flaky, nothing we can do" as a reason to ignore or skip a failure, because a flaky eval means the prompt, the code, or the test is not good enough yet.
- Don't weaken an eval to make it pass.
- Don't copy eval data into the prompt.
- Write prompts in markdown with simple, concise instructions.
- Write one sentence per rule and one rule per bullet, everywhere in the prompt.
- Don't add duplicate or obvious rules.
- Keep fixes general and short, with no long rules or many examples.
- Keep trying until it's fixed, and ask the author only after all ideas fail.
