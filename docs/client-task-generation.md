# Client Task Generation

This document describes the task types generated at runtime on the client for the Learn Helper learning system. These tasks are generated dynamically from existing word data without requiring AI.

## Ranking

Each task type is scored from 1 to 10 on seven parameters. Maximum total score is 70.

- **Retrieval Effort** - How hard the brain works to pull the word from memory. Passive reading = low effort. Producing word from scratch = high effort. Higher effort leads to stronger memory traces.
- **Cognitive Load** - Mental strain during the task. Too much (multiple inputs at once) overwhelms working memory. Too little (just staring) causes no learning. Optimal load = focused challenge.
- **Association Building** - Does the task connect the word to other knowledge? Isolated word-definition pairs = weak. Words linked to images, synonyms, contexts, personal experiences = strong network.
- **Feedback Quality** - What happens after an answer? No feedback = learner stays confused. "Correct/wrong" = minimal help. Showing correct answer + explanation + examples = strong learning signal.
- **Spacing Compatibility** - Can the task be repeated over time with growing intervals? One-time tasks fade. Tasks that return days/weeks later at optimal intervals = long-term retention.
- **Engagement Factor** - Does the learner want to continue? Boring repetition = dropout. Progress tracking, variety, achievable challenges = sustained motivation.
- **Transfer Potential** - Will the learner recognize this word when reading a real book or article? Drill-only tasks = weak transfer. Varied real-world contexts = strong transfer.

## Task Types

### 1. Showcase

**Description**: Students are presented with complete word information for initial recognition and familiarization. This is a passive learning phase that introduces words before active recall tasks.

**Schema**:

```typescript
{
  id: string; // Unique task ID (crypto.randomUUID())
  type: TaskType.Showcase;
  data: {
    id: number; // User word ID
    value: string; // The word itself
    spelling: string; // Phonetic spelling (e.g., "/əˈɡriː/")
    pronunciation: string; // Audio URL for pronunciation
    uaTranslation: string; // Ukrainian translation
    definition: string; // English definition
    level: Level; // CEFR level (A1-C1)
    partOfSpeech?: string | null; // Part of speech (noun, verb, etc.)
    list: List; // Source list (Oxford 5000 or Phrase List)
    link: string; // Link to Oxford Dictionary
  }
}
```

**Notes**:

- **No user input required**: This is a recognition-only task with no right/wrong answers
- **Always first**: Showcase tasks always appear at the beginning of a learning session, before any active recall tasks
- **Complete information display**: Shows all available word data including value, spelling, pronunciation, translation, definition, level, and part of speech (when available)
- **Audio playback**: Includes a button to play the word's pronunciation
- **External link**: Provides a link to the Oxford Dictionary for additional context
- **Source indication**: Shows whether the word comes from Oxford 5000 Words or Oxford Phrase List
- **One task per word**: Each learning word gets exactly one showcase task
- **Order preserved**: Showcase tasks maintain the order of the learning words array (not shuffled)

**UI Features**:

- Play pronunciation button with audio player
- External link to Oxford Dictionary
- Badge display for CEFR level, part of speech, and source list
- "Next" button to proceed to the next task

**Examples**:

- **Simple word**:
  - Word: "achieve"
  - Displays: "achieve", "/əˈtʃiːv/", "досягати", "to succeed in doing or completing something", B1, verb, oxford 5000

- **Phrase**:
  - Word: "take care of (sth)"
  - Displays: "take care of (sth)", phonetic spelling, Ukrainian translation, definition, level, phrase list

**Ranking**:

| Parameter             | Score | Reason                                                         |
| --------------------- | ----- | -------------------------------------------------------------- |
| Retrieval Effort      | 1     | No retrieval required; purely passive exposure                 |
| Cognitive Load        | 3     | Minimal load; just reading and processing visual/audio info    |
| Association Building  | 5     | Links word to translation, definition, pronunciation, spelling |
| Feedback Quality      | 2     | No feedback needed; informational only                         |
| Spacing Compatibility | 4     | Can be repeated but limited value without active recall        |
| Engagement Factor     | 5     | Visually rich; audio adds interest; prepares for challenges    |
| Transfer Potential    | 4     | Exposure without practice; weak standalone transfer            |
| **Overall**           | 24/70 |                                                                |

---

### 2. Word to Definition

**Description**: Students see a word with its spelling and pronunciation, then select the correct definition from multiple-choice options.

**Schema**:

```typescript
{
  id: string; // Unique task ID (crypto.randomUUID())
  type: TaskType.WordToDefinition;
  data: {
    id: number; // User word ID
    value: string; // The word itself
    spelling: string; // Phonetic spelling
    pronunciation: string; // Audio URL
    uaTranslation: string; // Ukrainian translation
    definition: string; // English definition
    level: Level; // CEFR level
    partOfSpeech?: string | null; // Part of speech
    list: List; // Source list
    link: string; // Oxford Dictionary link
    options: Array<{
      value: string; // Definition text
      isAnswer: boolean; // true for correct, false for wrong
    }>; // Up to 4 options: 1 correct, up to 3 wrong
    hint?: string; // Ukrainian translation (hint text)
  }
}
```

**Notes**:

- **Up to 4 options**: 1 correct answer and up to 3 distractors (fewer if the session has fewer than 4 learning words)
- **Distractors from session**: Wrong options are definitions from other words in the current learning session
- **Shuffled options**: Options are randomly shuffled so the correct answer isn't always in the same position
- **Shuffled tasks**: Word to Definition tasks are shuffled among themselves (not in showcase order)
- **Ukrainian hint available**: The hint button reveals the Ukrainian translation to help students
- **Audio support**: Pronunciation can be played while selecting the answer
- **Visual feedback**: Correct answers show green border, wrong answers show red border
- **Multiple attempts**: Students can select wrong options until they find the correct one (each wrong selection triggers onMistake)
- **Retry mechanism**: If a mistake is made, the task is added to the retry queue at the end of the session

**Examples**:

- **Simple word**:
  - Word: "achieve" (shown with spelling, pronunciation, level badge)
  - Options:
    - ✓ "to succeed in doing or completing something"
    - ✗ "to make something known to many people" (definition of "announce")
    - ✗ "to examine something carefully" (definition of "analyze")
    - ✗ "to accept or start to use something new" (definition of "adopt")

- **With hint used**:
  - Word: "nervous"
  - Hint (on click): "нервовий"
  - Options show up to 4 definitions, one correct

**Ranking**:

| Parameter             | Score | Reason                                                            |
| --------------------- | ----- | ----------------------------------------------------------------- |
| Retrieval Effort      | 4     | Recognition task; word visible, must recognize correct definition |
| Cognitive Load        | 5     | Compare 4 definitions; moderate complexity                        |
| Association Building  | 6     | Links word to definition; sees alternative definitions            |
| Feedback Quality      | 5     | Shows correct/wrong; no explanation of why                        |
| Spacing Compatibility | 7     | Repeatable; different distractors each session                    |
| Engagement Factor     | 6     | Interactive selection; clear progress; hint available             |
| Transfer Potential    | 5     | Recognizes definitions but doesn't practice production            |
| **Overall**           | 38/70 |                                                                   |

---

### 3. Definition to Word

**Description**: Students see a definition and must type the corresponding word.

**Schema**:

```typescript
{
  id: string; // Unique task ID (crypto.randomUUID())
  type: TaskType.DefinitionToWord;
  data: {
    id: number; // User word ID
    text: string; // The definition to identify
    word: string; // Correct answer (the word itself)
    hint?: string; // Ukrainian translation (optional help)
  }
}
```

**Notes**:

- **Free text input**: Students type the answer rather than selecting from options
- **Case insensitive**: Answer comparison ignores case (e.g., "Achieve" matches "achieve")
- **Parenthetical segments are optional**: For phrases like "agree with (sb)", accepted inputs include "agree with" or "agree with (sb)" (placeholders are not expanded to real words)
- **Alternatives inside parentheses**: For "(fun/interesting)" style answers, accepted inputs include "(fun)", "(interesting)", or "(fun/interesting)" (parentheses required)
- **Speech-to-text**: Includes a microphone button for voice input
- **Ukrainian hint available**: The hint button reveals the Ukrainian translation
- **Visual feedback**: Input field turns green (correct) or red (incorrect) after checking
- **Shows correct answer**: When incorrect, displays the expected answer
- **Single check**: After checking, students cannot modify their answer

**Examples**:

- **Simple word**:
  - Definition: "to succeed in doing or completing something"
  - Correct answer: "achieve"
  - Hint: "досягати"
  - User types: "achieve" → Correct

- **Phrase with placeholder**:
  - Definition: "to have the same opinion as someone"
  - Correct answer: "agree with (sb)"
  - Valid inputs: "agree with", "agree with (sb)"

- **Word with alternatives**:
  - Correct answer: "feel (happy/sad)"
  - Valid inputs: "feel", "feel (happy)", "feel (sad)", "feel (happy/sad)"

**Ranking**:

| Parameter             | Score | Reason                                                             |
| --------------------- | ----- | ------------------------------------------------------------------ |
| Retrieval Effort      | 7     | Must produce word from memory; definition provides context clue    |
| Cognitive Load        | 6     | Single definition focus; typing requires more effort than clicking |
| Association Building  | 6     | Strengthens definition-to-word link through production             |
| Feedback Quality      | 6     | Shows correct answer when wrong; no additional context             |
| Spacing Compatibility | 7     | Highly repeatable; same definition can be revisited                |
| Engagement Factor     | 5     | Text input less engaging than selection; STT adds interest         |
| Transfer Potential    | 7     | Active production; useful for writing and speaking                 |
| **Overall**           | 44/70 |                                                                    |

---

### 4. Word to Translation

**Description**: Students see a word with its spelling and pronunciation, then select the correct Ukrainian translation from multiple-choice options.

**Schema**:

```typescript
{
  id: string; // Unique task ID (crypto.randomUUID())
  type: TaskType.WordToTranslation;
  data: {
    id: number; // User word ID
    value: string; // The word itself
    spelling: string; // Phonetic spelling
    pronunciation: string; // Audio URL
    uaTranslation: string; // Ukrainian translation
    definition: string; // English definition
    level: Level; // CEFR level
    partOfSpeech?: string | null; // Part of speech
    list: List; // Source list
    link: string; // Oxford Dictionary link
    options: Array<{
      value: string; // Ukrainian translation
      isAnswer: boolean; // true for correct, false for wrong
    }>; // Up to 4 options: 1 correct, up to 3 wrong
    hint?: string; // English definition (hint text)
  }
}
```

**Notes**:

- **Up to 4 options**: 1 correct Ukrainian translation and up to 3 distractors (fewer if the session has fewer than 4 learning words)
- **Distractors from session**: Wrong options are Ukrainian translations from other words in the current learning session
- **Shuffled options**: Options are randomly shuffled
- **Shuffled tasks**: Word to Translation tasks are shuffled among themselves
- **Definition hint**: Unlike Word to Definition which uses translation as hint, this uses the English definition as hint
- **Audio support**: Pronunciation can be played while selecting
- **Same UI as Word to Definition**: Uses the same WordToOptions component
- **Multiple attempts allowed**: Can try wrong options until finding correct one

**Examples**:

- **Simple word**:
  - Word: "beautiful" (shown with spelling, pronunciation)
  - Options:
    - ✓ "красивий"
    - ✗ "швидкий" (translation of "fast")
    - ✗ "сильний" (translation of "strong")
    - ✗ "розумний" (translation of "smart")
  - Hint: "pleasing to the senses or mind"

- **Phrase**:
  - Word: "look forward to"
  - Options show up to 4 Ukrainian translations
  - Hint: "to feel excited about something that is going to happen"

**Ranking**:

| Parameter             | Score | Reason                                                 |
| --------------------- | ----- | ------------------------------------------------------ |
| Retrieval Effort      | 4     | Recognition task; must match word to Ukrainian         |
| Cognitive Load        | 5     | Compare 4 Ukrainian translations; bilingual processing |
| Association Building  | 6     | Links English word directly to Ukrainian meaning       |
| Feedback Quality      | 5     | Shows correct/wrong; no explanation                    |
| Spacing Compatibility | 7     | Repeatable; distractors vary by session                |
| Engagement Factor     | 6     | Interactive; definition hint provides learning moment  |
| Transfer Potential    | 6     | Builds translation mapping; useful for comprehension   |
| **Overall**           | 39/70 |                                                        |

---

### 5. Translation to Word

**Description**: Students see a Ukrainian translation and must type the corresponding English word.

**Schema**:

```typescript
{
  id: string; // Unique task ID (crypto.randomUUID())
  type: TaskType.TranslationToWord;
  data: {
    id: number; // User word ID
    text: string; // Ukrainian translation shown as prompt
    word: string; // Correct English word to type
    hint?: string; // English definition (optional help)
  }
}
```

**Notes**:

- **Free text input**: Students type the English word
- **Case insensitive**: Answer comparison ignores case
- **Flexible phrase matching**: Same validation logic as Definition to Word
- **Speech-to-text**: Microphone button for voice input
- **Definition hint**: The hint reveals the English definition
- **Same UI as Definition to Word**: Uses the same TextToWord component
- **Production task**: Requires active recall of English from Ukrainian

**Examples**:

- **Simple word**:
  - Ukrainian: "досягати"
  - Correct answer: "achieve"
  - Hint: "to succeed in doing or completing something"

- **Phrase**:
  - Ukrainian: "піклуватися про"
  - Correct answer: "take care of (sth)"
  - Valid inputs: "take care of", "take care of (sth)"

**Ranking**:

| Parameter             | Score | Reason                                                          |
| --------------------- | ----- | --------------------------------------------------------------- |
| Retrieval Effort      | 8     | Must produce English from Ukrainian; strong recall required     |
| Cognitive Load        | 6     | Single translation focus; bilingual production is demanding     |
| Association Building  | 7     | Strengthens Ukrainian-to-English link through active production |
| Feedback Quality      | 6     | Shows correct answer when wrong; definition hint available      |
| Spacing Compatibility | 7     | Highly repeatable; same translation different sessions          |
| Engagement Factor     | 5     | Text input; STT adds convenience                                |
| Transfer Potential    | 8     | Active English production; directly useful for speaking/writing |
| **Overall**           | 47/70 |                                                                 |

---

### 6. Pronunciation to Word

**Description**: Students listen to a word's pronunciation and must type the word they hear.

**Schema**:

```typescript
{
  id: string; // Unique task ID (crypto.randomUUID())
  type: TaskType.PronunciationToWord;
  data: {
    id: number; // User word ID
    pronunciation: string; // Audio URL for pronunciation
    spelling: string; // Phonetic spelling (collapsible hint)
    word: string; // Correct word to type
  }
}
```

**Notes**:

- **Audio-first**: Primary input is listening to pronunciation
- **Large play button**: Prominent circular button to play audio
- **Collapsible spelling hint**: Students can reveal the phonetic spelling if needed
- **No Ukrainian hint**: This task focuses purely on listening comprehension
- **Free text input**: Students type what they hear
- **Case insensitive**: Answer comparison ignores case
- **Flexible phrase matching**: Same validation logic as other text input tasks
- **Speech-to-text**: Microphone button available for voice input
- **Can replay**: Students can play the pronunciation multiple times

**Examples**:

- **Simple word**:
  - Audio plays: [achieve pronunciation]
  - Spelling hint (collapsible): "/əˈtʃiːv/"
  - Correct answer: "achieve"

- **Similar sounding words**:
  - Audio plays: [their pronunciation]
  - User must distinguish from "there", "they're"
  - Correct answer: "their"

**UI Features**:

- Large circular play button (Volume2 icon)
- Pulsing animation when audio is playing
- Collapsible `<details>` element for spelling hint
- Standard text input with STT support

**Ranking**:

| Parameter             | Score | Reason                                                                  |
| --------------------- | ----- | ----------------------------------------------------------------------- |
| Retrieval Effort      | 8     | Must produce spelling from audio; strong phonological-orthographic link |
| Cognitive Load        | 7     | Audio processing + spelling recall; challenging but focused             |
| Association Building  | 7     | Links pronunciation to written form; builds phonological awareness      |
| Feedback Quality      | 6     | Shows correct spelling; spelling hint available before checking         |
| Spacing Compatibility | 7     | Repeatable; audio-based practice remains valuable                       |
| Engagement Factor     | 7     | Audio interaction is engaging; different modality adds variety          |
| Transfer Potential    | 8     | Crucial for listening comprehension and spelling accuracy               |
| **Overall**           | 50/70 |                                                                         |

---

## Task Sequence

Client tasks are generated and presented in a specific order:

1. **Showcase tasks** - Always first, in word order (not shuffled)
2. **Word to Definition** - Shuffled among themselves
3. **Definition to Word** - Shuffled among themselves
4. **Word to Translation** - Shuffled among themselves
5. **Translation to Word** - Shuffled among themselves
6. **Pronunciation to Word** - Shuffled among themselves

This sequence follows a learning progression:

- **Order**: Showcase -> Word to Definition -> Definition to Word -> Word to Translation -> Translation to Word -> Pronunciation to Word
- **Why**: Definition and translation pairs use the same recognition/production pattern, so they are alternated before ending with listening-based recall

---

## Summary Ranking

| Task Type             | Score   |
| --------------------- | ------- |
| Pronunciation to Word | 50/70   |
| Translation to Word   | 47/70   |
| Definition to Word    | 44/70   |
| Word to Translation   | 39/70   |
| Word to Definition    | 38/70   |
| Showcase              | 24/70   |
| **Overall**           | 242/420 |
