---
name: run-evals
description: Run the evals one at a time - fix the prompt on failures and run again until they are stable.
---

## What I do

- Run only the evals related to the change, unless the author asks for more.
- Go through the runs **one at a time**, never in a bash loop:
  1. Run the evals once.
  2. Show the result: how many passed, which failed and why, and the streak (e.g. `streak 2/5`).
  3. If all passed, the streak goes up by 1. At 5 in a row (or the number the author asks for), stop and sum up.
  4. If something failed, the streak goes back to 0. Analyze the failures and say what the cause is (e.g. the prompt, the code, a wrong test or judge statement, or something else).
  5. Say what I suggest to do, then fix it.
  6. Run again.
- The goal is stable evals and stable prompts. Never accept "it's flaky, nothing we can do" as a reason to ignore, skip, or retry a failure. A flaky eval means the prompt, the code, or the test is not good enough yet, so find the cause and fix it. Report the real result of every run, even when it fails.
- Never use a loop or any repeat construct (like `for`, `while`, `seq`, `xargs`, `repeat`, `parallel`, or anything similar) to run evals, not even to re-run a single test to check how flaky it is. Every run is its own command. To check a flaky test, run it once per command.
- Don't weaken an eval just to make it pass.
- Write prompts in markdown, with simple, natural, concise instructions. Keep fixes general and short, with no long rules or lots of examples.
- Don't copy eval data into the prompt. That makes the evals meaningless.
- Keep trying until it's fixed. Only when you've tried all your ideas and still can't fix a test, stop and ask the author what to do.
