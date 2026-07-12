---
name: review-comments
description: Read all PR review comments and resolve them - fix, reply with the commit link, and close threads.
---

## What I do

- Read all open review comment threads on the current PR.
- For each comment: decide whether to fix or decline, reply accordingly, and resolve the thread.

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

## How to get thread node IDs

```bash
gh api graphql -f query='{
  repository(owner: "<owner>", name: "<repo>") {
    pullRequest(number: <pr>) {
      reviewThreads(first: 10) {
        nodes {
          id
          isResolved
          comments(first: 1) { nodes { body } }
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
