# Database Design

> **Abstract design.** This document captures the major structural decisions — the learning algorithm, queue mechanics, session logic — not a precise implementation spec. Minor details (missing `created_at` on some tables, `id` presence, exact index definitions) may be imprecise or incomplete and are expected to change during implementation. Don't get hung up on them here.

```mermaid
erDiagram
    user {
        id uuid PK
    }

    vocabulary_item {
        id uuid PK
        value text
        definition text
        ua_translation text
        part_of_speech varchar(32) "optional, enum: part_of_speech"
        spelling text
        pronunciation text "optional"
        link text "optional"
        created_at timestamptz "default NOW"
        updated_at timestamptz "default NOW"
    }

    grammar_topic {
        id uuid PK
        title text "unique (e.g. Affirmative Present Simple)"
        summary text "(for preview card)"
        description text "(markdown, for showcase task)"
        link text "optional"
        created_at timestamptz "default NOW"
        updated_at timestamptz "default NOW"
    }

    vocabulary_list {
        id uuid PK
        title varchar(255) "unique (e.g. Oxford 5000 A1)"
        created_at timestamptz "default NOW"
        updated_at timestamptz "default NOW"
    }

    grammar_topic_list {
        id uuid PK
        title varchar(255) "unique (e.g. A1 Grammar)"
        created_at timestamptz "default NOW"
        updated_at timestamptz "default NOW"
    }

    vocabulary_list_vocabulary_item {
        vocabulary_list_id uuid FK PK
        vocabulary_item_id uuid FK PK
        created_at timestamptz "default NOW"
    }

    grammar_topic_list_grammar_topic {
        grammar_topic_list_id uuid FK PK
        grammar_topic_id uuid FK PK
        created_at timestamptz "default NOW"
    }

    user_vocabulary_list {
        user_id uuid FK PK
        vocabulary_list_id uuid FK PK
        created_at timestamptz "default NOW"
    }

    user_grammar_topic_list {
        user_id uuid FK PK
        grammar_topic_list_id uuid FK PK
        session_counter integer "default 0"
        created_at timestamptz "default NOW"
        updated_at timestamptz "default NOW"
    }

    user_vocabulary_item {
        id uuid PK
        user_id uuid FK "unique with vocabulary_item_id"
        vocabulary_item_id uuid FK
        encounter_count integer
        status varchar(16) "enum: learning_status"
        enqueued_at timestamptz "default NOW"
        created_at timestamptz "default NOW"
        updated_at timestamptz "default NOW"
    }

    user_grammar_topic {
        id uuid PK
        user_id uuid FK "unique with grammar_topic_id"
        grammar_topic_id uuid FK
        encounter_count integer "0=new, 1+=review"
        status varchar(16) "enum: learning_status"
        enqueued_at timestamptz "default NOW"
        created_at timestamptz "default NOW"
        updated_at timestamptz "default NOW"
    }

    file {
        id uuid PK
        user_id uuid FK
        file_name text "(original filename)"
        file_path text "(relative path on disk)"
        mime_type varchar(64)
        size_bytes integer
        hash varchar(64) "(SHA-256, for caching/integrity)"
        created_at timestamptz "default NOW"
        updated_at timestamptz "default NOW"
    }

    reading {
        id uuid PK
        user_id uuid FK
        file_id uuid FK "unique"
        title text
        total_pages integer "set after upload"
        current_page integer "default 0"
        duration_ms integer "default 0"
        created_at timestamptz "default NOW"
        updated_at timestamptz "default NOW"
    }

    event {
        id uuid PK
        user_id uuid FK
        type varchar(48) "enum: event_type"
        user_vocabulary_item_id uuid FK "optional"
        user_vocabulary_item_ids jsonb "optional"
        vocabulary_item_id uuid FK "optional"
        user_grammar_topic_id uuid FK "optional"
        grammar_topic_id uuid FK "optional"
        reading_id uuid FK "optional"
        status varchar(16) "optional, enum: learning_status"
        user_vocabulary_item_task_type varchar(48) "optional, enum: user_vocabulary_item_task_type"
        user_grammar_topic_task_type varchar(48) "optional, enum: user_grammar_topic_task_type"
        field_name text "optional"
        duration_ms integer "optional"
        cost_in_nano_dollars integer "optional"
        input_tokens integer "optional"
        output_tokens integer "optional"
        created_at timestamptz "default NOW"
    }

    user ||--o{ user_vocabulary_list : "one-to-many"
    vocabulary_list ||--o{ user_vocabulary_list : "one-to-many"
    user ||--o{ user_grammar_topic_list : "one-to-many"
    grammar_topic_list ||--o{ user_grammar_topic_list : "one-to-many"
    user ||--o{ user_vocabulary_item : "one-to-many"
    user ||--o{ user_grammar_topic : "one-to-many"
    user ||--o{ event : "one-to-many"
    vocabulary_list ||--o{ vocabulary_list_vocabulary_item : "one-to-many"
    vocabulary_item ||--o{ vocabulary_list_vocabulary_item : "one-to-many"
    grammar_topic_list ||--o{ grammar_topic_list_grammar_topic : "one-to-many"
    grammar_topic ||--o{ grammar_topic_list_grammar_topic : "one-to-many"
    vocabulary_item ||--o{ user_vocabulary_item : "one-to-many"
    grammar_topic ||--o{ user_grammar_topic : "one-to-many"
    user_vocabulary_item ||--o{ event : "one-to-many"
    user_grammar_topic ||--o{ event : "one-to-many"
    vocabulary_item ||--o{ event : "one-to-many"
    grammar_topic ||--o{ event : "one-to-many"
    user ||--o{ file : "one-to-many"
    user ||--o{ reading : "one-to-many"
    file ||--|| reading : "one-to-one"
    reading ||--o{ event : "one-to-many"
```

## Enums

### event_type

- user-vocabulary-item-discovered
- user-vocabulary-item-task-failed
- user-vocabulary-item-task-showcase-viewed
- user-vocabulary-item-task-passed
- user-vocabulary-item-task-retry-passed
- user-vocabulary-item-task-hint-used
- user-vocabulary-item-task-generated
- user-vocabulary-item-moved-to-next-step
- vocabulary-item-updated
- user-grammar-topic-discovered
- user-grammar-topic-task-failed
- user-grammar-topic-task-showcase-viewed
- user-grammar-topic-task-passed
- user-grammar-topic-task-retry-passed
- user-grammar-topic-task-hint-used
- user-grammar-topic-task-generated
- user-grammar-topic-moved-to-next-step
- grammar-topic-updated
- reading-time-spent "fires every 5 minutes of active reading"
- reading-uploaded
- reading-downloaded
- reading-deleted

### user_vocabulary_item_task_type

- showcase
- vocabulary-item-to-definition
- definition-to-vocabulary-item
- vocabulary-item-to-translation
- translation-to-vocabulary-item
- pronunciation-to-vocabulary-item
- translate-english-sentence
- translate-ukrainian-sentence

### user_grammar_topic_task_type

- showcase
- make-sentence
- translate-to-english
- fill-in-the-blank
- find-mistake

### learning_status

- waiting — enrolled but not yet discovered; eligible for Discovery sessions only
- learning — discovered, actively in review rotation; eligible for Learning sessions only
- learned — completed the learning cycle; no longer appears in any session
- known — user marked as already known before discovery; skips Discovery entirely

### part_of_speech

- adjective
- adverb
- auxiliary-verb
- conjunction
- definite-article
- determiner
- exclamation
- indefinite-article
- infinitive-marker
- linking-verb
- modal-verb
- noun
- number
- ordinal-number
- preposition
- pronoun
- verb

## Field notes

### `user_grammar_topic.encounter_count`

Tracks the total number of times the user has reviewed this grammar topic. `0` means the topic has never been seen (new); `1+` means it has been reviewed at least once. Do **not** drop this field — `status` tells you the lifecycle stage, but `encounter_count` is the only record of how many times the topic has actually been reviewed.

### `user_vocabulary_item.encounter_count`

Tracks the number of successful confirmations in Learning sessions. Required to implement the "3 confirmations → learned" threshold. Cannot be derived from status alone.

### Grammar queue open notes

- End-of-list review state: when there are no new grammar topics left, the learning queue should still work while at least one topic has `status = 'learning'`. Avoid bugs where "no new topics" disables learning, or where `lastTopicId === currentTopicId` blocks progress when only one eligible review topic exists.
- Start-of-learning rhythm: starting with `new, new, new, ...` can make the next session fetch the first grammar topic as review, which may look like a bug to the user. Consider interleaving with odds like `new, new, review, review, new, review, review, ...`.

## Event table notes

### `user_vocabulary_item_ids`

Stores the list of `user_vocabulary_item` ids included in a single AI generation batch. Used by admins to trace which vocabulary items were responsible for an unexpectedly high AI cost on a given event.

## List-based learning

Both vocabulary and grammar are organised around **lists**. A user enrolls in a list; the list drives what they discover and review. Learning state (`encounter_count`, `status`) is stored globally per user per item — if an item is learned via one list it is learned everywhere.

### Learning philosophy: always-on, no time gates

The queue is designed for **infinite, on-demand practice** — the user opens the app whenever they want and there is always something to do. This is a deliberate rejection of the Anki/time-gated model where items have a `next_review_at` timestamp and the user hits a wall ("nothing due today") after clearing the deck.

A `next_review_at` approach is explicitly **not used** here. Locking items behind a future timestamp would force the user to either stop learning or switch to new words only, which defeats the purpose of review. Instead, reviewed items go to the back of the FIFO queue (`enqueued_at` reset to `NOW()`), so the queue is always full and always playable.

### User flow

1. User opens Vocabulary (or Grammar).
2. They see all available lists with an **Add** button.
3. After adding a list they see it in their list with:
   - A **progress bar** — `learned / total` items in that list.
   - A **Discovery** button — start a session of new, unseen items.
   - A **Learning** button — start a review session of previously seen items.
4. Tapping a button starts a session scoped to that list.

### Grammar sessions

Grammar has one topic per session. The app picks whether the session is **new** or **review** by following the **[new, old, old]** rhythm tracked in `user_grammar_topic_list.session_counter`:

| `session_counter % 3` | Session type |
| --------------------- | ------------ |
| 0                     | new topic    |
| 1                     | review       |
| 2                     | review       |

`session_counter` increments after each completed session.

## Grammar tasks\*

All tasks are BE-generated (LLM). When user starts reading the showcase article, the client requests task generation in the background.

Each session generates 4 tasks per grammar topic. Topics follow the [new, old, old] queue pattern.

### showcase

Read the grammar topic markdown article (description field).

### make_sentence

Arrange shuffled word tiles into a correct sentence.

```
[ to ] [ doesn't ] [ school ] [ She ] [ go ]
→ [ She ] [ doesn't ] [ go ] [ to ] [ school ]
```

### translate_to_english

See a Ukrainian sentence, build the English translation from shuffled word tiles.

```
"Вона не ходить до школи"
[ to ] [ doesn't ] [ school ] [ She ] [ go ]
→ [ She ] [ doesn't ] [ go ] [ to ] [ school ]
```

### fill_in_the_blank

Pick words from a shuffled word bank to fill one or more blanks. Word bank includes correct words + distractors.

```
If I ___ you, I ___ do this.
Word bank (shuffled): [ would ] [ was ] [ will ] [ were ] [ am ]
→ [ were ] , [ would ]
```

### find_mistake

Tap the word that contains a grammar mistake.

```
[ She ] [ don't ] [ go ] [ to ] [ school ]
→ tap [ don't ] (should be "doesn't")
```

## Readings

Users upload PDF files and read them via an integrated in-app reader. The app tracks the current page as a bookmark so users can resume where they left off.

Each reading belongs to one user. File data is stored on the local filesystem; metadata and progress live in the database.

### Storage

- **File table**: Generic, reusable for future file types. Stores physical file info (`file_path`, `mime_type`, `size_bytes`) and a SHA-256 `hash` for cache invalidation.
- **Reading table**: Domain entity linking a user to a file with a `title`, `total_pages`, and `current_page` bookmark.

### Upload flow

Client uploads PDF via multipart form → Server validates (mime type, size limit) → computes SHA-256 hash → stores file at `uploads/{user_id}/{file_id}.pdf` → creates `file` + `reading` records (`total_pages` extracted server-side).

### Download / serve flow

Server sets `ETag: {hash}` and `Cache-Control: public, max-age=31536000, immutable`. On file replacement the hash changes, so the browser fetches the new version automatically.

### File replacement

User or admin uploads a new file for an existing reading → Server replaces the file on disk → updates `file.hash`, `file.size_bytes`, `file.updated_at` → updates `reading.total_pages`.

### Reading progress

Client sends a heartbeat every ~1 minute with `current_page` and `+duration_ms` → Server updates `reading.current_page` and increments `reading.duration_ms`.

Page numbering is 1-indexed (matching pdf.js). `current_page = 0` (default) means the user hasn't opened the PDF yet.

Stats displayed on the readings list: `"Title — 42 / 100 — 5 min"`.

### File path pattern

```
uploads/{user_id}/{file_id}.pdf
```

> **Nomad note:** The `uploads/` directory must be on a persistent volume to survive allocation restarts.
