# Requirements

This document describes the target requirements for the next version of Learn Helper. It is not a description of the current implementation.

## Purpose

Learn Helper is an English learning application for Ukrainian speakers. It supports three learning domains: **vocabulary**, **grammar**, and **reading**. All three are designed to complement each other — vocabulary and grammar build active language knowledge, reading puts that knowledge into passive context.

## Users

A single user type: a Ukrainian speaker learning English. No admin roles, no multi-tenancy beyond individual user accounts.

## Learning philosophy

### Always-on, no time gates

The app is designed for on-demand practice. A user opens it whenever they want and always has something to do. This is a deliberate rejection of the Anki model where items are locked behind a future review date and the user hits a wall after clearing the deck.

Instead, reviewed items go to the back of the queue. The queue is always full and always playable.

### Global learning state

A vocabulary item or grammar topic that a user has encountered is tracked globally — one record per user per item, regardless of how many lists contain it. If a word is learned through one list, it is considered learned in all lists that contain it. This prevents redundant re-learning of the same content across lists.

### List-scoped sessions

Despite global state, sessions are scoped to a specific list. A user practices words from "Oxford 5000 A1" separately from "Phrasal Verbs". This gives learners focus and a sense of structured progress per list, while the underlying learning state remains shared.

### New and review items

`new` and `review` describe encounter history, not lifecycle status. A new item has `encounter_count = 0`. A review item has `encounter_count > 0`. For vocabulary and grammar sessions, these labels are used inside the eligible lifecycle statuses rather than replacing them.

---

## Vocabulary

### Lists

Vocabulary is organised into named lists (e.g. "Oxford 5000 A1", "Oxford 5000 B2"). Lists are predefined content — users enroll in them, not create them.

A user can enroll in multiple lists. The same word can appear in multiple lists. Enrolling in a list that contains already-known words does not reset their state.

### Session types

Each list exposes two session buttons:

- **Discovery** — introduces words the user has never seen before.
- **Learning** — reviews words the user has already encountered but not yet mastered.

Sessions are list-scoped: only words belonging to that list appear.

### Learning status lifecycle

Each word per user moves through these statuses:

- waiting — enrolled but not yet discovered
- learning — discovered, actively in review rotation
- learned — completed the learning cycle; no longer appears in Learning sessions
- known — user marked as already known before discovery

### Status transitions

Transitions between statuses are **user-driven**: after each word encounter, the app asks the user to decide whether to keep practicing the word or move it forward in the learning cycle. The app never advances a word automatically.

- **waiting → learning**: triggered when the user encounters the word for the first time in a Discovery session.
- **learning → learned**: triggered when the user has chosen to move the word forward **3 times** across Learning sessions. Until then, the word remains in `learning` and can appear again in future Learning sessions.
- **waiting → known**: triggered when the user explicitly marks a word as already known during a Discovery session, skipping the learning cycle entirely.

After a Learning session, each practiced word gives the user a choice to move it forward in the learning cycle. If the user does not feel comfortable with the word yet, they can leave it at the same step; in that case its `encounter_count` and queue position do not change.

### Queue mechanics

Words are served in queue order — the longest-untouched word comes first. When a user moves a word forward after a Learning session, the word moves to the back of the relevant queue. If the user keeps the word at the same step, it preserves its current queue position.

Discovery sessions are available while the list has `waiting` words. Learning sessions are available while the list has `learning` words. If the selected session type has no items, the app shows an empty-state message for that session.

### Progress bar

Each list shows a progress bar for the current user. `learned` and `known` are both complete states for progress purposes, but they remain distinct statuses: `known` means the user marked the word as already known, while `learned` means the word passed through the learning process.

### Task types

Each vocabulary session generates a sequence of tasks per word. Showcase is counted as a task, but it is a read-only task rather than a recall task.

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

Each grammar topic per user follows the same status model as vocabulary:

- waiting — enrolled but not yet discovered
- learning — discovered, actively in review rotation
- learned — completed the learning cycle; no longer appears in Learning sessions
- known — user marked as already known before discovery

### Session rhythm

Grammar sessions follow a repeating **new → review → review** pattern. New content is introduced regularly but not every session, giving review sessions space to reinforce recent topics. The pattern defines the preferred item type for each session: `new, review, review, new, review, review...`.

The **new** phase prefers a topic with `encounter_count = 0`. Review phases prefer a topic with `encounter_count > 0`. After each topic encounter, the user manually decides whether to keep practicing the topic or move it forward in the learning cycle. A `learning` topic becomes `learned` when the user has chosen to move it forward **3 times** across review sessions. The app never advances a grammar topic automatically.

If no topic of the preferred type is available (e.g. all new topics are exhausted), the system falls back to the other type. The repeating rhythm still advances after the session. If neither type has topics, the list shows an empty-state message.

### Task types

Each grammar session generates 5 tasks for the selected topic. Showcase is counted as a task, but it is a read-only task rather than an exercise task.

- **Showcase** — read the grammar topic markdown article
- **Make Sentence** — arrange shuffled word tiles into a correct sentence
- **Translate to English** — see a Ukrainian sentence, build the English translation from shuffled word tiles
- **Fill in the Blank** — pick correct words from a word bank to fill blanks in a sentence
- **Find Mistake** — tap the word containing a grammar error in a sentence

Grammar exercise tasks are AI-generated at session start. Showcase uses the selected topic's markdown article.

---

## Reading

Users upload PDF files and read them via an in-app reader. Reading builds passive English comprehension alongside active vocabulary and grammar work.

### Behavior

- Each PDF belongs to one user.
- The app tracks the current page as a bookmark so users can resume where they left off.
- Reading time is tracked and displayed on the readings list.
- The list shows each book's title, page progress, and total reading time.

### Upload and storage

- Users upload a PDF through the app.
- The server validates the file type and size before accepting it. PDF uploads are limited to 20 MB.
- File metadata and reading progress are stored in the database; the file itself is stored in a directory on the server.

### Progress tracking

The app periodically saves the user's current page and accumulated reading time so progress is preserved across sessions.

---

## Events

Useful user actions are recorded as events. Events serve two purposes:

- **Activity feed** — a chronological log of what the user has done
- **Statistics** — aggregate data for the user-facing `/statistics` page, such as task completion rates and time spent

Events are append-only. They reference the user, the relevant entity (vocabulary item, grammar topic, reading), and optional metadata (task type, status, duration, AI token cost when available).
