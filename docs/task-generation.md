# Task Generation

This document summarizes learning task generation across server (AI-generated) and client (runtime) systems. It provides a shared scoring model, a one-line intent for each task in order, and summary rankings pulled from the source docs.

## Goal

Task generation aims to build a short Learn session (under 30 minutes) that helps learners get acquainted with a focused set of items rather than master them deeply. At the end of the session, learners decide whether to move each item to the next step based on their confidence.

## Task sources

- Server tasks: AI-generated per target item; designed to create varied sentence-level contexts and distractors.
- Client tasks: generated at runtime from existing item data; no AI required; options are drawn from the current session.

## Repeatable learning algorithm

The repetition schedule is driven by `moveUserVocabularyItemToNextStep` and two fields on each item: `encounterCount` and `enqueuedAt`.

- Learning queue: `getUserVocabularyListLearnItems` builds a batch from new and review item pools, each ordered by `enqueuedAt` ascending, then `id`.
- Step advance (per completed item):
  - Increment `encounterCount` for the item that was just completed.
  - If `encounterCount` reaches 3, mark the item `Learned` and clear `enqueuedAt` so it leaves the learning queue.
  - Otherwise, keep the item in `Learning` and set `enqueuedAt` to the current time, pushing it to the back of the queue.

This means an item returns behind older queued items. Each item advances up to 3 times before it is marked learned and removed from rotation.

## Scoring model

Each task type is scored 1-10 across seven parameters (max 70 total):

- Retrieval Effort: how much recall is required.
- Cognitive Load: mental strain of the task.
- Association Building: how well the task builds semantic links.
- Feedback Quality: strength of corrective feedback.
- Spacing Compatibility: how well it repeats over time.
- Engagement Factor: how motivating the task feels.
- Transfer Potential: how well it helps real-world reading/speaking.

## Order criteria

These criteria define why a task belongs earlier or later in a sequence.

- Familiarity ramp: start with exposure before demanding recall.
- Cue gradient: move from recognition to production while reducing hints.
- Cognitive load ladder: increase difficulty steadily without sharp jumps.
- Modality progression: introduce text and translation before audio-first tasks.
- Feedback scaffolding: early tasks should provide clearer feedback and retries.
- Interleaving and contrast: alternate directions and task types to reduce interference.
- Transfer proximity: place tasks closest to real-world use later.
- Engagement pacing: mix task styles and end with a satisfying challenge.

## Task order

### Server tasks (runtime sequence)

- **Translate English Sentence**: Arrange shuffled Ukrainian words to form the translation of an English sentence.
- **Translate Ukrainian Sentence**: Arrange shuffled English words to form the translation of a Ukrainian sentence.

### Client tasks (runtime sequence)

- **Showcase**: Introduce the item with full metadata before recall starts.
- **Item to Definition**: Confirm recognition by matching an item to its meaning.
- **Definition to Item**: Move into production by typing the item from its meaning.
- **Item to Translation**: Reinforce bilingual mapping from English to Ukrainian.
- **Translation to Item**: Push active recall from Ukrainian to English.
- **Pronunciation to Item**: Finish with listening-based spelling recall.

## Order scoring (current order)

Scores are 0-10 per criterion. Overall score is the average of all criteria (0-10). Rows follow the task sequence in `src/components/learn.tsx`.

| Task                         | Source | Familiarity | Cues | Load | Modality | Feedback | Interleave | Transfer | Engagement | Overall |
| ---------------------------- | ------ | ----------- | ---- | ---- | -------- | -------- | ---------- | -------- | ---------- | ------- |
| Showcase                     | Client | 10          | 10   | 9    | 5        | 2        | 2          | 3        | 5          | 5.8     |
| Item to Definition           | Client | 8           | 7    | 7    | 6        | 7        | 5          | 5        | 6          | 6.4     |
| Definition to Item           | Client | 5           | 5    | 5    | 6        | 6        | 6          | 8        | 6          | 5.9     |
| Item to Translation          | Client | 7           | 7    | 6    | 6        | 7        | 7          | 6        | 6          | 6.5     |
| Translation to Item          | Client | 4           | 4    | 5    | 6        | 6        | 7          | 9        | 7          | 6.0     |
| Pronunciation to Item        | Client | 3           | 3    | 4    | 10       | 6        | 7          | 8        | 7          | 6.0     |
| Translate English Sentence   | Server | 7           | 7    | 6    | 6        | 7        | 6          | 8        | 6          | 6.6     |
| Translate Ukrainian Sentence | Server | 6           | 7    | 6    | 6        | 7        | 7          | 8        | 5          | 6.5     |

## Summary ranking

### Server (AI-generated)

| Task Type                    | Score  |
| ---------------------------- | ------ |
| Translate English Sentence   | 47/70  |
| Translate Ukrainian Sentence | 47/70  |
| **Overall**                  | 94/140 |

### Client (runtime)

| Task Type             | Score   |
| --------------------- | ------- |
| Pronunciation to Item | 50/70   |
| Translation to Item   | 47/70   |
| Definition to Item    | 44/70   |
| Item to Translation   | 39/70   |
| Item to Definition    | 38/70   |
| Showcase              | 24/70   |
| **Overall**           | 242/420 |
