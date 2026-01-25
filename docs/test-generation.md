# Test Generation

This document summarizes learning task generation across server (AI-generated) and client (runtime) systems. It provides a shared scoring model, a one-line intent for each task in order, and summary rankings pulled from the source docs.

## Task sources

- Server tasks: AI-generated per target word or phrase; designed to create varied sentence-level contexts and distractors.
- Client tasks: generated at runtime from existing word data; no AI required; options are drawn from the current session.

## Repeatable learning algorithm

The repetition schedule is driven by `moveUserWordToNextStep` and two fields on each word: `encounterCount` and `wordsToUnlock`.

- Learning queue: `getLearningWords` returns words with `status = Learning`, ordered by `wordsToUnlock` ascending, then `id`.
- Step advance (per completed word):
  - Increment `encounterCount` for the word that was just completed.
  - Decrement `wordsToUnlock` by 1 for all words where it is >= 1.
  - If `encounterCount` reaches 3, mark the word `Learned` and set `wordsToUnlock` to 0 (it leaves the learning queue).
  - Otherwise, set the word's `wordsToUnlock` to `max(wordsToUnlock) + 3`, pushing it to the back of the queue with a 3-step buffer.

This means a word reappears after at least 3 other step advances, and spacing increases as the queue grows. Each word is shown up to 3 times before it is marked learned and removed from rotation.

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

### Server tasks (catalog order)

- **Fill in the Gap**: Kick off with contextual recall to anchor meaning.
- **Translate English Sentence**: Reinforce comprehension by mapping English to Ukrainian.
- **Translate Ukrainian Sentence**: Flip direction to practice English production.
- **Synonym and Antonym**: Expand semantic links with near and opposite meanings.
- **Find Nonsense Sentence**: Stress-test usage by spotting impossible contexts.
- **Word Order**: Rebuild sentence structure to cement grammar around the target.

### Client tasks (runtime sequence)

- **Showcase**: Introduce the word with full metadata before recall starts.
- **Word to Definition**: Confirm recognition by matching word to meaning.
- **Definition to Word**: Move into production by typing the word from meaning.
- **Word to Translation**: Reinforce bilingual mapping from English to Ukrainian.
- **Translation to Word**: Push active recall from Ukrainian to English.
- **Pronunciation to Word**: Finish with listening-based spelling recall.

## Order scoring (current order)

Scores are 0-10 per criterion. Overall score is the average of all criteria (0-10). Rows follow the task sequence in `src/components/learning.tsx`.

| Task                         | Source | Familiarity | Cues | Load | Modality | Feedback | Interleave | Transfer | Engagement | Overall |
| ---------------------------- | ------ | ----------- | ---- | ---- | -------- | -------- | ---------- | -------- | ---------- | ------- |
| Showcase                     | Client | 10          | 10   | 9    | 5        | 2        | 2          | 3        | 5          | 5.8     |
| Word to Definition           | Client | 8           | 7    | 7    | 6        | 7        | 5          | 5        | 6          | 6.4     |
| Definition to Word           | Client | 5           | 5    | 5    | 6        | 6        | 6          | 8        | 6          | 5.9     |
| Word to Translation          | Client | 7           | 7    | 6    | 6        | 7        | 7          | 6        | 6          | 6.5     |
| Translation to Word          | Client | 4           | 4    | 5    | 6        | 6        | 7          | 9        | 7          | 6.0     |
| Pronunciation to Word        | Client | 3           | 3    | 4    | 10       | 6        | 7          | 8        | 7          | 6.0     |
| Translate English Sentence   | Server | 7           | 7    | 6    | 6        | 7        | 6          | 8        | 6          | 6.6     |
| Translate Ukrainian Sentence | Server | 6           | 7    | 6    | 6        | 7        | 7          | 8        | 5          | 6.5     |
| Fill in the Gap              | Server | 6           | 6    | 6    | 6        | 6        | 6          | 8        | 5          | 6.1     |
| Synonym and Antonym          | Server | 5           | 6    | 6    | 6        | 5        | 6          | 7        | 5          | 5.8     |
| Find Nonsense Sentence       | Server | 6           | 6    | 5    | 6        | 7        | 7          | 7        | 7          | 6.4     |
| Word Order                   | Server | 4           | 6    | 4    | 6        | 6        | 6          | 7        | 7          | 5.8     |

## Summary ranking

### Server (AI-generated)

| Task Type                    | Score   |
| ---------------------------- | ------- |
| Fill in the Gap              | 46/70   |
| Translate English Sentence   | 45/70   |
| Translate Ukrainian Sentence | 45/70   |
| Synonym and Antonym          | 45/70   |
| Word Order                   | 43/70   |
| Find Nonsense Sentence       | 42/70   |
| **Overall**                  | 266/420 |

### Client (runtime)

| Task Type             | Score   |
| --------------------- | ------- |
| Pronunciation to Word | 50/70   |
| Translation to Word   | 47/70   |
| Definition to Word    | 44/70   |
| Word to Translation   | 39/70   |
| Word to Definition    | 38/70   |
| Showcase              | 24/70   |
| **Overall**           | 242/420 |
