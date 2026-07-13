---
name: review-comments
description: Walk through PR review comments one at a time with the author - assess each, propose a fix, and wait for a decision before replying and resolving.
---

## What I do

- Read all open review comment threads on the current PR.
- Go through the threads **one at a time**, never in bulk:
  1. Show a link to the thread, the comment, and my assessment: is this a real/valid issue, or not?
  2. If valid, propose a concrete fix. If not, explain why I think it doesn't apply.
  3. Ask the author what to do: apply the fix, decline with a reason, or something else.
  4. Wait for the author's decision - do not act without it.
  5. Once decided: make the fix (if any), then wait for the author's feedback, then reply to the thread and resolve it once they confirm everything is fine.
  6. Only then move on to the next comment.
- I never fix, reply to, or resolve more than one thread without author input in between.
- Exception: if multiple threads are the same underlying issue (e.g. the same outdated GitHub Action version repeated across 20 workflow files), I group them and treat them as one - one assessment, one proposed fix, one decision from the author - then apply that single decision to all matching threads (fix once if a single commit covers them all, reply to each, resolve each).
- This is only for currently open/unresolved threads. Reviewers add new comments after re-reviewing, so this skill is meant to be run again on later review passes - it just picks up whatever is unresolved at that point.

## Reply formats

Fixed with a commit:

```
<commit-url>
```

e.g. `https://github.com/allohamora/learn-helper/commit/abc1234`

Declined with a reason:

```
<Reason why this is not needed.>
```

e.g. `We don't use forks in this repository, so this doesn't apply here.`

## How to reply to a comment

```bash
gh api repos/<owner>/<repo>/pulls/<pr>/comments/<comment-id>/replies \
  -X POST \
  -f body="https://github.com/<owner>/<repo>/commit/<sha>"
```

## How to get threads and comments

```bash
gh api graphql -f query='{
  repository(owner: "<owner>", name: "<repo>") {
    pullRequest(number: <pr>) {
      reviewThreads(first: 10) {
        pageInfo { hasNextPage endCursor }
        nodes {
          id
          isResolved
          path
          line
          comments(first: 10) {
            nodes {
              url
              body
              author { login }
            }
          }
        }
      }
    }
  }
}'
```

## How to resolve a thread

```bash
gh api graphql -f query='mutation {
  resolveReviewThread(input: {threadId: "<thread-node-id>"}) {
    thread { isResolved }
  }
}'
```
