# Business Requirements

## Purpose

Learn Helper is an English learning application for Ukrainian speakers. It supports three learning domains: **vocabulary**, **grammar**, and **reading**. All three are designed to complement each other — vocabulary and grammar build active language knowledge, reading puts that knowledge into passive context.

## Users

A single user type: a Ukrainian speaker learning English. No admin roles, no multi-tenancy beyond individual user accounts.

## Learning philosophy

### Always-on, no time gates

The app is designed for on-demand practice. A user opens it whenever they want and always has something to do. This is a deliberate rejection of the Anki model where items are locked behind a future `next_review_at` timestamp and the user hits a wall after clearing the deck.

Instead, reviewed items go to the back of the FIFO queue. The queue is always full and always playable.

### Global learning state

A vocabulary item or grammar topic that a user has encountered is tracked globally — one record per user per item, regardless of how many lists contain it. If a word is learned through one list, it is considered learned in all lists that contain it. This prevents redundant re-learning of the same content across lists.

### List-scoped sessions

Despite global state, sessions are scoped to a specific list. A user practices words from "Oxford 5000 A1" separately from "Phrasal Verbs". This gives learners focus and a sense of structured progress per list, while the underlying learning state remains shared.

---

## Vocabulary

### Lists

Vocabulary is organised into named lists (e.g. "Oxford 5000 A1", "Oxford 5000 B2"). Lists are predefined content — users enroll in them, not create them.

A user can enroll in multiple lists. The same word can appear in multiple lists. Enrolling in a list that contains already-known words does not reset their state.

### Session types

Each list exposes two session buttons:

- **Discovery** — introduces new, unseen words (`encounter_count = 0`). The user sees each word for the first time.
- **Learning** — reviews previously seen words (`encounter_count > 0`, `status != learned`). The user practices words they are actively working through.

Sessions are list-scoped: only words belonging to that list appear.

### Learning status lifecycle

Each word per user moves through these statuses:

- `waiting` — enrolled but not yet discovered
- `learning` — discovered, actively in review rotation
- `learned` — completed the learning cycle; no longer appears in Learning sessions
- `known` — user marked as already known before discovery

### Queue mechanics

Words are ordered by `enqueued_at`. After each encounter, `enqueued_at` resets to `NOW()`, pushing the word to the back of the queue. The queue is infinite and always non-empty as long as there are unlearned words in the list.

### Progress bar

Each list shows a progress bar: `learned / total` words in that list for the current user.

### Task types

Each vocabulary session generates a sequence of tasks per word:

- **Showcase** — display full word metadata (definition, translation, pronunciation) before recall begins
- **Word to Definition** — match the word to its meaning
- **Definition to Word** — type the word from its definition
- **Word to Translation** — match English word to Ukrainian translation
- **Translation to Word** — type the English word from Ukrainian
- **Pronunciation to Word** — type the word from its audio pronunciation
- **Translate English Sentence** (AI-generated) — arrange shuffled Ukrainian words to translate an English sentence
- **Translate Ukrainian Sentence** (AI-generated) — arrange shuffled English words to translate a Ukrainian sentence

---

## Grammar

### Lists

Grammar topics are also organised into lists (e.g. "A1 Grammar", "B2 Grammar"). A user enrolls in a grammar list and works through its topics one per session.

### Session rhythm

Grammar sessions follow a **[new, old, old]** rhythm tracked via a `session_counter` on the user-list record:

| `session_counter % 3` | Session type |
| --------------------- | ------------ |
| 0                     | new topic    |
| 1                     | review       |
| 2                     | review       |

This ensures new content is introduced regularly but not every session, giving review sessions space to reinforce recent topics.

### Topic selection with fallback

The app picks the next topic based on the current session type, ordered by `enqueued_at`. If no topic of the preferred type is available (e.g. all new topics are exhausted), it falls back to the other type. If neither has topics, the list is complete.

### Task types

Each grammar session generates 4 tasks for the selected topic:

- **Showcase** — read the grammar topic markdown article
- **Make Sentence** — arrange shuffled word tiles into a correct sentence
- **Translate to English** — see a Ukrainian sentence, build the English translation from shuffled word tiles
- **Fill in the Blank** — pick correct words from a word bank to fill blanks in a sentence
- **Find Mistake** — tap the word containing a grammar error in a sentence

All grammar tasks are AI-generated at session start.

---

## Reading

Users upload PDF files and read them via an in-app reader. Reading builds passive English comprehension alongside active vocabulary and grammar work.

### Behavior

- Each PDF belongs to one user.
- The app tracks the current page as a bookmark so users can resume where they left off.
- Reading time is tracked in milliseconds and displayed on the readings list.
- Stats shown: `"Title — 42 / 100 pages — 5 min"`.

### Upload and storage

- Client uploads a PDF via multipart form.
- Server validates mime type and size, computes a SHA-256 hash, stores the file at `uploads/{user_id}/{file_id}.pdf`.
- File metadata and reading progress are stored in the database; the file itself lives on disk.
- The hash is used for HTTP caching (`ETag`). Replacing a file updates the hash, invalidating the client cache automatically.

### Progress tracking

The client sends a heartbeat roughly every minute with the current page and elapsed time. The server updates the bookmark and increments total reading duration.

---

## Events

All significant user actions are recorded as events. Events serve two purposes:

- **Activity feed** — a chronological log of what the user has done
- **Analytics** — aggregate data for understanding learning patterns (task completion rates, time spent, AI cost per user)

Events are append-only. They reference the user, the relevant entity (vocabulary item, grammar topic, reading), and optional metadata (task type, status, duration, AI token cost).
