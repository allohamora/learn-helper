# Database Design

```mermaid
erDiagram
    vocabulary_item {
        id uuid PK
        value text
        definition text
        ua_translation text
        part_of_speech text "optional"
        spelling text
        pronunciation text "optional"
        link text "optional"
        created_at timestamptz "default NOW"
        updated_at timestamptz "default NOW"
    }

    grammar_topic {
        id uuid PK
        title text "unique (e.g. Affirmative Present Simple)"
        description text
        examples json "string[]"
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

    user_vocabulary_item {
        id uuid PK
        user_id text
        vocabulary_item_id uuid FK
        vocabulary_items_to_unlock number "default 0"
        encounter_count number "default 0"
        status varchar(16) "enum: learning_status"
        created_at timestamptz "default NOW"
        updated_at timestamptz "default NOW"
    }

    user_grammar_topic {
        id uuid PK
        user_id text
        grammar_topic_id uuid FK
        topics_to_unlock number "default 0"
        encounter_count number "default 0"
        status varchar(16) "enum: learning_status"
        created_at timestamptz "default NOW"
        updated_at timestamptz "default NOW"
    }

    event {
        id uuid PK
        user_id text
        type varchar(48) "enum: event_type"
        user_vocabulary_item_id uuid FK "optional"
        user_vocabulary_item_ids json "optional"
        vocabulary_item_id uuid FK "optional"
        user_grammar_topic_id uuid FK "optional"
        grammar_topic_id uuid FK "optional"
        status varchar(16) "optional"
        user_vocabulary_item_task_type varchar(48) "optional, enum: user_vocabulary_item_task_type"
        field_name text "optional"
        duration_ms number "optional"
        cost_in_nano_dollars number "optional"
        input_tokens number "optional"
        output_tokens number "optional"
        created_at timestamptz "default NOW"
        updated_at timestamptz "default NOW"
    }

    vocabulary_list }o--o{ vocabulary_item : "many-to-many"
    grammar_topic_list }o--o{ grammar_topic : "many-to-many"
    vocabulary_item ||--o{ user_vocabulary_item : "one-to-many"
    grammar_topic ||--o{ user_grammar_topic : "one-to-many"
    user_vocabulary_item ||--o{ event : "one-to-many"
    user_grammar_topic ||--o{ event : "one-to-many"
    vocabulary_item ||--o{ event : "one-to-many"
    grammar_topic ||--o{ event : "one-to-many"
```

## Enums

### event_type

- user_vocabulary_item_discovered
- user_vocabulary_item_task_failed
- user_vocabulary_item_task_showcase_viewed
- user_vocabulary_item_task_passed
- user_vocabulary_item_task_retry_passed
- user_vocabulary_item_task_hint_used
- user_vocabulary_item_task_generated
- user_vocabulary_item_moved_to_next_step
- vocabulary_item_updated
- user_grammar_topic_discovered
- user_grammar_topic_task_failed
- user_grammar_topic_task_showcase_viewed
- user_grammar_topic_task_passed
- user_grammar_topic_task_retry_passed
- user_grammar_topic_task_hint_used
- user_grammar_topic_task_generated
- user_grammar_topic_moved_to_next_step
- grammar_topic_updated

### user_vocabulary_item_task_type

- showcase
- vocabulary_item_to_definition
- definition_to_vocabulary_item
- vocabulary_item_to_translation
- translation_to_vocabulary_item
- pronunciation_to_vocabulary_item
- translate_english_sentence
- translate_ukrainian_sentence

### learning_status

- waiting
- learning
- learned
- known
