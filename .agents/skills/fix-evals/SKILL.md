---
name: fix-evals
description: Run the evals, fix failures by re-running only the failed tests, and stop when the full suite passes 5 times in a row.
---

## What I do

- Run only the evals related to the change, unless the author asks for more.
- Run each command on its own, never in a loop or repeat construct (`for`, `while`, `seq`, `xargs`, `repeat`, `parallel`).

## Full loop

- Run all the related evals.
- Save the full output to a temp file, so the result is not lost.
- Show only the counts, the failed test names, and the failure reasons, not the full output.
- After each full run, log one line with the full loop streak (e.g. `full loop: 1/5`).
- If all passed, add 1 to the full loop streak.
- If something failed, reset the full loop streak to 0 and start the fix loop.
- Stop and sum up at 5 full passes in a row, or the number the author asks for.

## Fix loop

- Name the cause of each failure: the prompt, the code, a wrong test or judge statement, or something else.
- Say what I suggest.
- Make a change that fixes that cause, for every failed test, before running anything.
- Run only the fixed tests together as one group, not the whole suite.
- Run the group, each run as its own command, and after each run log one line with the fix loop streak of each test (e.g. `fix loop: test a 3/5, test b 3/5`).
- If a test fails, the fix is wrong, so reset its fix loop streak to 0 and change its fix.
- When a test reaches a fix loop streak of 5, drop it from the group.
- Keep running and fixing the rest of the group.
- When the group is empty, go back to the full loop.

## Instructions

- Aim for stable evals and stable prompts.
- Never accept "it's flaky, nothing we can do" as a reason to ignore or skip a failure, because a flaky eval means the prompt, the code, or the test is not good enough yet.
- Never re-run without a change, because a re-run with no change is a gamble, not a fix.
- Don't weaken an eval to make it pass.
- Don't copy eval data into the prompt.
- Write prompts in markdown with simple, concise instructions.
- Write one sentence per rule and one rule per bullet, everywhere in the prompt.
- Don't add duplicate or obvious rules.
- Keep fixes general and short, with no long rules or many examples.
- Never stop the loop or ask the author before the stop condition, except after all ideas fail.
