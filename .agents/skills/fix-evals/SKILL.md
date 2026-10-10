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

- Read the reasoning of the model and the judge for each failure, to find the step where the logic went wrong, and fix the rule that led to it.
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

- Aim for stable evals and predictable prompts, so the same input gives about the same output on every run.
- When a rule allows more than one valid answer, add a tie-breaker that picks one, like the dictionary form, the masculine form first, the most neutral word, etc.
- Never accept "it's flaky, nothing we can do" as a reason to ignore or skip a failure, because a flaky eval means the prompt, the code, or the test is not good enough yet.
- Never re-run without a change, because a re-run with no change is a gamble, not a fix.
- Don't weaken an eval to make it pass.
- Don't copy eval data into the prompt.
- Write prompts in markdown with simple, concise, natural instructions.
- Write one sentence per rule and one rule per bullet, everywhere in the prompt, and give each rule one job and a clear scope.
- Don't add duplicate or obvious rules, and extend an existing rule instead of adding a new one when you can.
- Keep fixes short, with no long rules or many examples.
- Make rules direct, so they leave less room for a mistake.
- Make rules general, so they also handle future cases and not just the failed one, by stating the reason behind the right answer instead of mapping one input to one answer.
- End a list of examples with `etc.`, like `a, b, c, etc.`, so the LLM handles more cases than just the listed ones.
- Never stop the loop or ask the author before the stop condition, except after all ideas fail.
- Treat the judge as a validator that only checks the output, one rule per statement.
- Never put how to handle a case in the judge, because that makes it a god prompt.
- Fix a gap by tightening the prompt or the judge statement, never with a costlier model or more reasoning.
