---
name: fix-evals
description: Run the evals, fix failures by re-running only the failed tests, and stop when the full suite passes 5 times in a row.
---

## What I do

- Run only the evals related to the change, unless the author asks for more.
- Run each command on its own, never in a loop or repeat construct (`for`, `while`, `seq`, `xargs`, `repeat`, `parallel`).
- Save the full output of each run to a temp file, so the results do not disappear.

## Full loop

- Run the evals in scope.
- If all passed, add 1 to the full loop streak.
- If something failed, reset the full loop streak to 0.
- Write one line in the chat with the run number, the passed count, and the full loop streak, so the author can follow the loop (e.g. `full run 3: 79/81, full loop: 0/5`).
- Under it, list the failed test names and the failure reasons, never the full output.
- If something failed, start the fix loop.
- Stop at 5 full passes in a row, or the number the author asks for.
- When I stop, for any reason, sum up the work: the number of full runs and fix runs, the full loop streak, what I fixed, what still fails and why, and the decisions left for the author.

## Fix loop

- Read the reasoning of the model and the judge for each failure, when there is one, to find the step that went wrong or was skipped.
- Name the cause of each failure: the prompt, the code, a wrong test or judge statement, or something else.
- Say what I suggest.
- Make a change that fixes that cause, for every failed test, before running anything.
- Run only the fixed tests together as one group, not the whole suite.
- Run the group, each run as its own command.
- If a test passes, add 1 to its fix loop streak.
- If a test fails, the fix is wrong, so reset its fix loop streak to 0.
- Write one line in the chat with the fix run number and the fix loop streak of each test, so the author can follow the loop (e.g. `fix run 2: test a 3/5, test b 0/5`).
- Under it, list the failed test names and the failure reasons, never the full output.
- When a test reaches a fix loop streak of 5, drop it from the group.
- Change the fix of each failed test.
- Keep running the rest of the group.
- When the group is empty, go back to the full loop.

## Instructions

- Aim for stable evals and predictable prompts, so the same input gives about the same output on every run.
- Never accept "it's flaky, nothing we can do" as a reason to ignore or skip a failure, because a flaky eval means the prompt, the code, or the test is not good enough yet.
- Never re-run a failed test without a change, because a re-run with no change is a gamble, not a fix.
- Try to fix with a general instruction first, and if it doesn't work, then use prompting techniques like few-shot examples, etc.
- Don't weaken an eval to make it pass.
- Don't copy eval data into the prompt, including into few-shot examples, so the eval still checks a result the prompt didn't hand over.
- Never stop the loop or ask the author before the stop condition, except after all ideas fail.
- Keep the judge a validator that only checks the output, one instruction per statement, so it never holds how to handle a case.
- Fix a gap by tightening the prompt or the judge statement, never with a costlier model or more reasoning.
