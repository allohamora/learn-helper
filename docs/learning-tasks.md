# Learning Tasks

This document describes the task types used in the Learn Helper learning system. Each task type is generated dynamically using AI based on the target vocabulary word or phrase.

## Task Types

### 1. Fill in the Gap

**Description**: Students complete a sentence by filling in a blank with the target word or phrase.

**Schema**:

```typescript
{
  id: number;
  task: string; // Sentence with "___" placeholder
  answer: string; // Correct word/phrase to fill the blank
}
```

**Notes**:

- **Grammatically correct**: All sentences must be grammatically correct and use natural, fluent English
- **Natural language**: Content should sound authentic and conversational, as a native speaker would use it
- **Keep tasks unique**: Avoid repeating sentence structures, topics, or contexts across different words to maintain engagement
- **Make it enjoyable**: Use interesting, relatable scenarios that learners can connect with their daily lives
- **Level-appropriate grammar**: Match sentence complexity to the word's CEFR level - for B1, use structures like second conditional; for B2, use mixed conditionals or complex tenses; for A2, keep structures simple
- **Modern expressions**: Prefer modern, conversational English over formal or outdated expressions
- **Punctuation**: Sentences can end with periods (.), exclamation marks (!), or question marks (?) based on the sentence type
- **Phrase adaptation**: When target is a phrase with placeholders like "agree with (sb)", adapt naturally by providing context (e.g., "I agree with you")
- **Article context**: For articles (a/an), ensure the sentence requires that specific article based on the following word's sound (vowel vs. consonant)
- **Clarity over complexity**: Keep sentences concise (5-15 words) to maintain focus on the target vocabulary
- **Function words**: For grammatical words (articles, prepositions, conjunctions), create contexts where their specific usage is meaningful and not interchangeable
- **Target word placement**: The target word/phrase should appear only in the blank, nowhere else in the sentence
- **Case handling**: Answers are evaluated case-insensitively, but should be provided in the appropriate form

**Examples**:

- **Simple word**:
  - Word: "achieve"
  - Task: "She worked hard to \_\_\_ her goals."
  - Answer: "achieve"

- **Phrase**:
  - Word: "take care of (sth)"
  - Task: "I \_\_\_ you."
  - Answer: "agree with" (adapts placeholder naturally)

- **Multi-word phrase**:
  - Word: "look forward to"
  - Task: "We \_\_\_ the weekend."
  - Answer: "look forward to"

- **Article (a)**:
  - Word: "a"
  - Task: "She wants to buy \_\_\_ new car."
  - Answer: "a"

- **Article (an)**:
  - Word: "an"
  - Task: "He ate \_\_\_ apple for breakfast."
  - Answer: "an"

- **Exclamation sentence**:
  - Word: "amazing"
  - Task: "This view is \_\_\_!"
  - Answer: "amazing"

- **Question sentence**:
  - Word: "understand"
  - Task: "Do you \_\_\_ the question?"
  - Answer: "understand"

- **Level A1** (Simple present tense, basic daily routine):
  - Word: "eat"
  - Task: "I \_\_\_ breakfast every morning."
  - Answer: "eat"

- **Level A2** (Simple past tense, familiar context):
  - Word: "visit"
  - Task: "We \_\_\_ our grandparents last weekend."
  - Answer: "visit"

- **Level B1** (Second conditional, hypothetical situation):
  - Word: "choose"
  - Task: "If I could \_\_\_ any job, I would be a pilot."
  - Answer: "choose"

- **Level B2** (Present perfect tense, achievement context):
  - Word: "accomplish"
  - Task: "She has \_\_\_ more than anyone expected this year."
  - Answer: "accomplish"

- **Level C1** (Modal verb with advanced vocabulary, subtle meaning):
  - Word: "undermine"
  - Task: "His constant criticism could \_\_\_ her confidence."
  - Answer: "undermine"

---

### 2. Translate English Sentence

**Description**: Students select the correct Ukrainian translation of an English sentence containing the target word/phrase.

**Schema**:

```typescript
{
  id: number;
  sentence: string; // English sentence with target word
  options: Array<{
    value: string; // Ukrainian translation
    isAnswer: boolean; // true for correct translation
  }>;
}
```

**Notes**:

- **All options grammatically correct**: All 4 Ukrainian options must be grammatically perfect with natural word order, proper case endings, correct verb conjugations, and appropriate preposition usage
- **Natural language**: Both English sentences and Ukrainian translations must sound fluent and authentic to native speakers
- **Only one correct answer**: Ensure that only ONE option is a valid translation - avoid creating scenarios where multiple translations could be considered correct (e.g., "She is at home" should not have both "Вона вдома" and "Вона в будинку" as they could both be valid in different contexts)
- **No synonym verbs in wrong options**: CRITICAL - Wrong options must NOT use Ukrainian verbs that are synonyms or could mean the same action in context. Examples of BANNED pairs:
  - "додати" (add) ↔ "покласти" (put) - both could mean adding something
  - "прийти" (come) ↔ "піти" (go) - in Ukrainian context like "піті на зустріч" can mean arriving, similar to "прийти"
  - Wrong options must use CLEARLY DIFFERENT, NON-SYNONYMOUS verbs
- **Wrong options must be contextually related**: CRITICAL - Wrong options should stay in the same general topic/context as the correct answer but differ in specific details. DO NOT create completely unrelated sentences about different topics.
  - GOOD: "I am going to do my homework." → Wrong: "I finished my homework.", "I am doing my project.", "I forgot my homework."
  - BAD: "I am going to do my homework." → Wrong: "I will buy a book.", "They went to cinema.", "She likes music." (completely unrelated topics)
- **Differ in meaning, not grammar**: Wrong options should change meaning through: wrong content words (different NON-SYNONYM verb, noun, adjective, time word within same context), wrong number (singular/plural with all required grammatical adjustments), wrong tense, wrong subject/pronoun - but always remain grammatically valid and contextually related
- **Relatable content**: Choose everyday situations and topics that learners can relate to
- **Level-appropriate grammar**: Match sentence complexity to the word's CEFR level - for B1, use structures like second conditional; for B2, use mixed conditionals or complex tenses; for A2, keep structures simple
- **No literal translations**: Ukrainian options must sound natural, not word-for-word literal translations
- **Punctuation**: Use appropriate sentence types - statements (.), questions (?), and exclamations (!) - based on context
- **Complete meaning**: The correct translation must fully capture the English sentence's meaning, not just contain the target word
- **Phrase integration**: When the target is a phrase, incorporate the entire phrase naturally within the sentence
- **Concise sentences**: Keep sentences short (1-12 words) for clarity and learning focus
- **Exact count**: Always provide exactly 4 options (1 correct, 3 incorrect)

**Examples**:

- **Simple sentence**:
  - Word: "beautiful"
  - Sentence: "The sunset is beautiful."
  - Options:
    - ✓ "Захід сонця прекрасний."
    - ✗ "Захід сонця яскравий." (different adjective)
    - ✗ "Схід сонця прекрасний." (sunrise instead of sunset)
    - ✗ "Сонце прекрасне." (missing "sunset")

- **Phrase in context**:
  - Word: "take care of (sb/sth)"
  - Sentence: "I take care of my dog."
  - Options:
    - ✓ "Я доглядаю за своїм собакою."
    - ✗ "Я люблю свого собаку." (wrong verb)
    - ✗ "Я граюся зі своїм собакою." (playing, not caring)
    - ✗ "Я годую свого собаку." (only feeding)

- **Article (a)**:
  - Word: "a"
  - Sentence: "I need a new phone."
  - Options:
    - ✓ "Мені потрібен новий телефон."
    - ✗ "Мені потрібні нові телефони." (plural instead of singular)
    - ✗ "Мені потрібен цей новий телефон." (specific phone, not indefinite)
    - ✗ "Мені потрібен телефон." (missing "new")

- **Preposition (at)**:
  - Word: "at"
  - Sentence: "She is at the store."
  - Options:
    - ✓ "Вона в магазині."
    - ✗ "Вона біля магазину." (near the store)
    - ✗ "Вона йде до магазину." (going to the store)
    - ✗ "Вона працює в магазині." (works at the store, different meaning)

- **Question sentence**:
  - Word: "like"
  - Sentence: "Do you like this song?"
  - Options:
    - ✓ "Тобі подобається ця пісня?"
    - ✗ "Ти слухаєш цю пісню?" (are you listening)
    - ✗ "Ти знаєш цю пісню?" (do you know)
    - ✗ "Тобі подобається цей фільм?" (movie instead of song)

- **Level A1** (Simple present tense, basic vocabulary):
  - Word: "play"
  - Sentence: "Children play in the park."
  - Options:
    - ✓ "Діти грають у парку."
    - ✗ "Діти гуляють у парку." (wrong verb - walk instead of play)
    - ✗ "Діти бігають у парку." (wrong verb - run instead of play)
    - ✗ "Діти сплять у парку." (wrong verb - sleep instead of play)

- **Level A2** (Simple past tense with time expression):
  - Word: "bought"
  - Sentence: "She bought a new dress yesterday."
  - Options:
    - ✓ "Вона купила нову сукню вчора."
    - ✗ "Вона купила нову сукню торік." (wrong time - last year instead of yesterday)
    - ✗ "Вона купила нові сукні вчора." (wrong number - dresses plural instead of dress singular)
    - ✗ "Вона носила нову сукню вчора." (wrong verb - wore instead of bought)

- **Level B1** (Second conditional expressing hypothetical situation):
  - Word: "discover"
  - Sentence: "If I traveled more, I would discover new cultures."
  - Options:
    - ✓ "Якби я більше подорожував, я б відкривав нові культури."
    - ✗ "Якби я більше подорожував, я б вивчав нові культури." (wrong verb - study instead of discover)
    - ✗ "Коли я подорожую, я відкриваю нові культури." (wrong structure - first conditional instead of second)
    - ✗ "Я подорожую і відкриваю нові культури." (wrong structure - simple present instead of conditional)

- **Level B2** (Past perfect passive, complex temporal relationship):
  - Word: "established"
  - Sentence: "The company had been established before the crisis began."
  - Options:
    - ✓ "Компанія була заснована до того, як почалася криза."
    - ✗ "Компанія була створена до того, як почалася криза." (wrong verb - created instead of established)
    - ✗ "Організація була заснована до того, як почалася криза." (wrong noun - organization instead of company)
    - ✗ "Компанія була заснована після того, як почалася криза." (wrong time relation - after instead of before)

- **Level C1** (Modal verb with negative, abstract noun, advanced vocabulary):
  - Word: "underestimate"
  - Sentence: "We shouldn't underestimate the complexity of this issue."
  - Options:
    - ✓ "Ми не повинні недооцінювати складність цього питання."
    - ✗ "Ми не повинні переоцінювати складність цього питання." (opposite meaning - overestimate instead of underestimate)
    - ✗ "Нам не слід оцінювати складність цього питання." (missing prefix - evaluate instead of underestimate)
    - ✗ "Ми не можемо недооцінювати простоту цього питання." (wrong noun - simplicity instead of complexity)

---

### 3. Translate Ukrainian Sentence

**Description**: Students select the correct English translation of a Ukrainian sentence. The correct option must contain the exact target English word/phrase.

**Schema**:

```typescript
{
  id: number;
  sentence: string; // Ukrainian sentence
  options: Array<{
    value: string; // Complete English sentence
    isAnswer: boolean; // true for correct translation
  }>;
}
```

**Notes**:

- **All options grammatically correct**: All 4 English options must be grammatically perfect, fluent, and complete sentences with proper subject-verb agreement, correct tense usage, and natural word order
- **Authentic language**: Ukrainian sentences should sound conversational and authentic, English options must be fluent
- **Only one correct answer**: Ensure that only ONE option is a valid translation - avoid scenarios where multiple English translations could be equally correct for the Ukrainian sentence
- **No synonyms or alternative phrases**: Incorrect options must NOT use synonyms or different phrases that could create valid alternative translations - this is strictly forbidden (e.g., if target is "nervous", don't use "worried"; if target is "get rid of", don't use "throw away")
- **Wrong options must be contextually related**: CRITICAL - Wrong options should stay in the same general topic/context as the correct answer but differ in specific details. DO NOT create completely unrelated sentences about different topics.
  - GOOD: "We are going to travel tomorrow." → Wrong: "We traveled yesterday.", "We are traveling now.", "They are going to travel."
  - BAD: "We are going to travel tomorrow." → Wrong: "She will cook dinner.", "He likes books.", "They bought a car." (completely unrelated topics)
- **Differ in meaning, not grammar**: Wrong options should change meaning through: wrong content words (different non-synonym verb, noun, adjective within same context), wrong pronouns (with correctly adjusted verb forms), altered specificity (this/these, some/all), wrong tense, or wrong prepositions - but always remain grammatically valid and contextually related
- **Engaging scenarios**: Use interesting, modern contexts that feel relevant to learners
- **Level-appropriate grammar**: Match sentence complexity to the word's CEFR level - for B1, use structures like second conditional; for B2, use mixed conditionals or complex tenses; for A2, keep structures simple
- **Natural Ukrainian**: Create Ukrainian sentences that sound authentic and conversational, not artificial
- **Punctuation**: Use appropriate sentence types - statements (.), questions (?), exclamations (!) - based on context
- **Complete sentences only**: All English options must be full, grammatically correct sentences with subject and verb, never fragments or phrases
- **Exact word requirement**: The correct option MUST contain the exact target English word/phrase (case-sensitive matching during generation)
- **Full translation**: The correct option must translate the ENTIRE Ukrainian sentence, not just include the target word somewhere
- **Brief and focused**: Keep sentences short (1-12 words) and limited to exactly one sentence
- **Exactly 4 options**: Always provide 1 correct and 3 incorrect options

**Examples**:

- **Simple word**:
  - Word: "nervous"
  - Sentence: "Він нервує перед іспитом."
  - Options:
    - ✓ "He is nervous before the exam." (exact word match)
    - ✗ "He is nervous after the exam." (wrong preposition)
    - ✗ "He was nervous before the exam." (wrong tense)
    - ✗ "They are nervous before the exam." (wrong pronoun)

- **Phrase**:
  - Word: "get rid of"
  - Sentence: "Мені потрібно позбутися цих старих речей."
  - Options:
    - ✓ "I need to get rid of these old things."
    - ✗ "I need to get rid of some old things." (altered specificity)
    - ✗ "I want to get rid of these old things." (wrong verb)
    - ✗ "We need to get rid of these old things." (wrong pronoun)

- **Article (an)**:
  - Word: "an"
  - Sentence: "Це цікава історія."
  - Options:
    - ✓ "This is an interesting story." (exact word match)
    - ✗ "This is an old story." (wrong adjective - old instead of interesting)
    - ✗ "That is an interesting story." (wrong demonstrative - that instead of this)
    - ✗ "This is an interesting book." (wrong noun - book instead of story)

- **Conjunction (but)**:
  - Word: "but"
  - Sentence: "Я втомлений, але щасливий."
  - Options:
    - ✓ "I am tired but happy."
    - ✗ "I am tired and happy." (different conjunction)
    - ✗ "I was tired but happy." (wrong tense)
    - ✗ "They are tired but happy." (wrong pronoun)

- **Exclamation sentence**:
  - Word: "wonderful"
  - Sentence: "Яка чудова ідея!"
  - Options:
    - ✓ "What a wonderful idea!"
    - ✗ "What a wonderful plan!" (plan instead of idea)
    - ✗ "That's a wonderful idea." (different structure)
    - ✗ "What wonderful ideas!" (plural instead of singular)

- **Question sentence**:
  - Word: "ready"
  - Sentence: "Ти готовий?"
  - Options:
    - ✓ "Are you ready?"
    - ✗ "Are you tired?" (wrong adjective - tired instead of ready)
    - ✗ "Are they ready?" (wrong pronoun - they instead of you)
    - ✗ "Is he ready?" (wrong pronoun - he instead of you)

- **Level A1** (Simple present tense, basic vocabulary):
  - Word: "drink"
  - Sentence: "Я п'ю воду."
  - Options:
    - ✓ "I drink water."
    - ✗ "I drink juice." (wrong noun - juice instead of water)
    - ✗ "I drink tea." (wrong noun - tea instead of water)
    - ✗ "He drinks water." (wrong pronoun - he instead of I, with correctly adjusted verb)

- **Level A2** (Simple past tense with time expression):
  - Word: "watched"
  - Sentence: "Ми дивилися фільм минулого вечора."
  - Options:
    - ✓ "We watched a movie last night."
    - ✗ "We watched a show last night." (wrong noun - show instead of movie)
    - ✗ "We watched a movie yesterday morning." (wrong time - yesterday morning instead of last night)
    - ✗ "They watched a movie last night." (wrong pronoun - they instead of we)

- **Level B1** (Second conditional expressing hypothetical situation):
  - Word: "achieve"
  - Sentence: "Якби вона більше працювала, вона б досягла своєї мети."
  - Options:
    - ✓ "If she worked harder, she would achieve her goal."
    - ✗ "If she studied harder, she would achieve her goal." (wrong verb - studied instead of worked)
    - ✗ "If he worked harder, he would achieve his goal." (wrong pronoun - he instead of she, with correctly adjusted possessive)
    - ✗ "If she worked harder, she would achieve their goals." (wrong possessive and number - their goals instead of her goal)

- **Level B2** (Past perfect passive voice, complex temporal sequence):
  - Word: "been informed"
  - Sentence: "Мене повідомили про зміни до того, як вони сталися."
  - Options:
    - ✓ "I had been informed about the changes before they happened."
    - ✗ "I had been informed about the updates before they happened." (wrong noun - updates instead of changes)
    - ✗ "She had been informed about the changes before they happened." (wrong pronoun - she instead of I)
    - ✗ "I had been informed about the changes after they happened." (wrong preposition - after instead of before)

- **Level C1** (Formal register, gerund after preposition, polite request):
  - Word: "refrain"
  - Sentence: "Прошу вас утримуватися від коментарів до завершення презентації."
  - Options:
    - ✓ "Please refrain from commenting until the presentation is over."
    - ✗ "Please refrain from commenting until the discussion is over." (wrong noun - discussion instead of presentation)
    - ✗ "Please refrain from commenting after the presentation is over." (wrong preposition - after instead of until)
    - ✗ "We refrain from commenting until the presentation is over." (wrong pronoun - we instead of you implied in please)

---

### 4. Synonym and Antonym

**Description**: Students identify a synonym (similar meaning) and antonym (opposite meaning) for the target word/phrase.

**Schema**:

```typescript
{
  id: number;
  synonym: string; // Word/phrase with similar meaning
  antonym: string; // Word/phrase with opposite meaning
}
```

**Notes**:

- **Grammatically correct**: All synonyms and antonyms must be proper, grammatically correct words or phrases
- **Natural vocabulary**: Use words that sound natural and commonly used by native speakers
- **Best possible examples**: Choose the most accurate, clear synonyms and antonyms that truly represent similar/opposite meanings - avoid loose approximations or words that only work in specific contexts
- **Learner-friendly vocabulary**: Use clear, common words that match the learner's level - avoid rare, archaic, or overly technical terms
- **Match difficulty**: Synonyms and antonyms should be at a similar difficulty level to the target word
- **Primary meaning first**: When a word has multiple meanings, focus on the primary one indicated by the provided definition
- **Concise answers**: Prefer single-word responses; use short phrases only when necessary
- **Part of speech consistency**: Synonym and antonym must match the target word's part of speech
- **Avoid self-reference**: Never use the target word itself as its own synonym or antonym
- **Flexible pairings**: For phrasal verbs, antonyms may be single words (e.g., "give up" → "continue") or other phrases
- **Limited antonym cases**: Some words ("orange", "table") lack clear antonyms - provide the most reasonable opposite concept
- **Article handling**: Articles don't follow traditional synonym/antonym rules:
  - "a" → Synonym: "an" (both indefinite), Antonym: "the" (definite)
  - "the" → Synonym: "this/that" (definiteness), Antonym: "a/an" (indefinite)
- **Function words**: For grammatical words (prepositions, conjunctions), focus on opposites in meaning or function
- **Lowercase preferred**: Keep outputs lowercase unless dealing with proper nouns
- **No punctuation**: Avoid unnecessary quotes or punctuation in answers

**Examples**:

- **Common adjective**:
  - Word: "happy"
  - Synonym: "joyful"
  - Antonym: "sad"

- **Verb**:
  - Word: "increase"
  - Synonym: "grow"
  - Antonym: "decrease"

- **Abstract noun**:
  - Word: "success"
  - Synonym: "achievement"
  - Antonym: "failure"

- **Phrase**:
  - Word: "give up"
  - Synonym: "quit"
  - Antonym: "persist"

- **Preposition (above)**:
  - Word: "above"
  - Synonym: "over"
  - Antonym: "below"

- **Article (a)**:
  - Word: "a"
  - Synonym: "an"
  - Antonym: "the"

---

### 5. Find Nonsense Sentence

**Description**: Students identify which sentence uses the target word/phrase incorrectly or nonsensically.

**Schema**:

```typescript
{
  id: number;
  options: Array<{
    value: string; // Complete sentence
    isAnswer: boolean; // true for the INCORRECT/nonsense sentence
    description?: string; // Explanation (only for incorrect sentence)
  }>;
}
```

**Notes**:

- **Grammatically correct (for correct sentences)**: The three correct sentences must be grammatically perfect and natural
- **Natural English**: All correct sentences must sound authentic and fluent to native speakers
- **Unique contexts**: Vary sentence topics and structures to keep the exercise interesting and engaging
- **Enjoyable mistakes**: Create errors that are memorable and even amusing while being clearly wrong
- **Level-appropriate grammar**: Match sentence complexity to the word's CEFR level - for B1, use structures like second conditional; for B2, use mixed conditionals or complex tenses; for A2, keep structures simple
- **Punctuation variety**: Include questions (?), exclamations (!), and statements (.) to add diversity and make the exercise more dynamic
- **Obviously wrong**: The incorrect sentence must be CLEARLY nonsensical, not just awkward or uncommon - it should be meaningless to native speakers
- **Strong correct examples**: The three correct sentences must demonstrate proper, natural usage with well-formed English
- **Types of nonsense**:
  - Semantic absurdity (inanimate objects doing animate actions: "The chair can swim")
  - Logical impossibility (time paradoxes: "I will do it yesterday")
  - Grammatical breakdown (completely malformed structures)
  - Category mistakes (applying concepts to wrong categories)
- **Explanation required**: Only the incorrect sentence gets a `description` field briefly explaining why it's nonsense
- **No subtle errors**: Avoid sentences that are merely "less natural" or "stylistically odd" - they must be impossible or meaningless
- **Complete sentences**: Use full, properly structured sentences (3-15 words)
- **Exactly 4 options**: Always 1 incorrect (the answer) and 3 correct sentences
- **All sentences contain target**: Every sentence option must include the target word or phrase

**Examples**:

- **Semantic nonsense**:
  - Word: "swim"
  - Options:
    - ✓ "The chair can swim very fast." (description: "Chairs are inanimate objects and cannot swim")
    - ✗ "Fish swim in the ocean."
    - ✗ "I learned to swim last summer."
    - ✗ "She swims every morning."

- **Logical impossibility**:
  - Word: "yesterday"
  - Options:
    - ✗ "I went to the store yesterday."
    - ✗ "Yesterday was a busy day."
    - ✓ "I will do it yesterday." (description: "Cannot perform future actions in the past - tense contradiction")
    - ✗ "Yesterday's meeting was cancelled."

- **Grammatical breakdown**:
  - Word: "agree with"
  - Options:
    - ✗ "I agree with your opinion."
    - ✗ "They don't agree with the decision."
    - ✓ "The book agrees with on the table." (description: "Grammatically broken - 'agrees with' used without proper subject or object")
    - ✗ "We agree with the new policy."

- **Article misuse (a)**:
  - Word: "a"
  - Options:
    - ✗ "She bought a new book."
    - ✗ "I need a minute."
    - ✓ "He is a very tall." (description: "Article 'a' cannot be used before an adjective without a noun - grammatically incorrect")
    - ✗ "That's a good idea."

- **Article misuse (an)**:
  - Word: "an"
  - Options:
    - ✗ "I ate an orange yesterday."
    - ✗ "She is an engineer."
    - ✓ "We saw an at the zoo." (description: "Article 'an' used without a noun - incomplete and meaningless")
    - ✗ "It's an important meeting."

- **Preposition misuse (in)**:
  - Word: "in"
  - Options:
    - ✗ "She lives in London."
    - ✗ "The book is in the bag."
    - ✓ "I am in very hungry." (description: "Preposition 'in' incorrectly inserted before adjective - creates nonsense")
    - ✗ "We arrived in the morning."

- **Question sentence**:
  - Word: "where"
  - Options:
    - ✗ "Where are you going?"
    - ✗ "Where is the station?"
    - ✓ "Where is the blue very?" (description: "Nonsensical word order and structure - 'where' used with meaningless phrase")
    - ✗ "Where do you live?"

- **Exclamation sentence**:
  - Word: "beautiful"
  - Options:
    - ✗ "The sunset is beautiful!"
    - ✗ "What a beautiful day!"
    - ✓ "The rock is beautiful eating!" (description: "Illogical combination - 'beautiful' incorrectly placed with 'eating' and 'rock' creating meaningless sentence")
    - ✗ "She looks beautiful!"

- **Level A1** (Simple present tense, basic semantic error):
  - Word: "run"
  - Options:
    - ✗ "Dogs run in the park."
    - ✗ "Children run to school."
    - ✓ "The table runs to the kitchen." (description: "Semantic absurdity - tables are inanimate and cannot run")
    - ✗ "I run every morning."

- **Level A2** (Past tense with time contradiction):
  - Word: "bought"
  - Options:
    - ✗ "She bought a new phone yesterday."
    - ✓ "He bought a new house tomorrow." (description: "Tense contradiction - past tense 'bought' cannot occur with future time 'tomorrow'")
    - ✗ "They bought tickets for the concert."
    - ✗ "We bought fresh bread this morning."

- **Level B1** (Second conditional context, semantic impossibility):
  - Word: "imagine"
  - Options:
    - ✗ "If I could imagine anything, I would create a new world."
    - ✗ "I can't imagine life without music."
    - ✓ "The chair imagines about flying to Mars." (description: "Semantic absurdity - inanimate objects cannot imagine or have thoughts")
    - ✗ "Try to imagine what tomorrow will bring."

- **Level B2** (Passive voice context, logical impossibility with natural phenomena):
  - Word: "established"
  - Options:
    - ✗ "The university was established in 1850."
    - ✗ "New regulations have been established recently."
    - ✓ "The river established itself by running uphill." (description: "Logical and physical impossibility - rivers cannot establish themselves or run uphill")
    - ✗ "They established a strong connection over time."

- **Level C1** (Advanced vocabulary, abstract concepts, multiple semantic violations):
  - Word: "undermine"
  - Options:
    - ✗ "Such actions could undermine public trust."
    - ✗ "The scandal undermined his political career."
    - ✓ "The color blue undermined the mathematical equation's happiness." (description: "Multiple category errors - colors cannot undermine, equations don't have emotions, abstract semantic breakdown")
    - ✗ "Corruption undermines democratic institutions."

---

### 6. Word Order

**Description**: Students arrange scrambled words to form a correct sentence containing the target word/phrase.

**Schema**:

```typescript
{
  id: number;
  sentence: string; // Words in CORRECT order (space-separated)
}
```

**Notes**:

- **Grammatically correct**: The correct sentence must be grammatically perfect and natural English
- **Natural flow**: Sentences must sound modern, conversational, and authentic - never forced or artificial
- **Engaging content**: Use interesting topics that are satisfying to reconstruct, with clear logical word relationships
- **Level-appropriate grammar**: Match sentence complexity to the word's CEFR level - for B1, use structures like second conditional; for B2, use mixed conditionals or complex tenses; for A2, keep structures simple
- **Punctuation**: Use appropriate sentence types - statements (.), questions (?), exclamations (!) - based on context
- **Punctuation attachment**: Punctuation marks (periods, commas, question marks, exclamation marks) should be attached to words, not as separate tokens (e.g., "ready?" not "ready" + "?")
- **Complete separation**: All words, including articles (a, an, the) and prepositions, must be individual words in the string
- **Phrase splitting**: Multi-word phrases like "take care of" are split into separate words ("take", "care", "of") for arrangement
- **Space consistency**: Each word must be separated by exactly one space in the correct answer
- **Capitalization rules**: Only capitalize the first word of the sentence (and proper nouns if present)
- **Manageable length**: Keep sentences concise (5-15 words) so the task isn't overwhelming

**Examples**:

- **Simple sentence**:
  - Word: "beautiful"
  - Sentence: "The garden is beautiful."
  - Scrambled (in UI): ["garden", "The", "is", "beautiful."]

- **Sentence with articles**:
  - Word: "achieve"
  - Sentence: "She will achieve her goals."
  - Scrambled: ["her", "will", "She", "goals", "achieve."]

- **Phrase preservation** ("take care of" is split into individual words):
  - Word: "take care of"
  - Sentence: "I take care of my plants."
  - Scrambled: ["my", "care", "I", "plants.", "of", "take"]

- **Article (a)** (Article "a" must be placed before the adjective-noun combination):
  - Word: "a"
  - Sentence: "She bought a red car."
  - Scrambled: ["bought", "red", "a", "She", "car."]

- **Article (an)** (Article "an" must precede the vowel-starting adjective):
  - Word: "an"
  - Sentence: "He is an excellent student."
  - Scrambled: ["student.", "excellent", "is", "an", "He"]

- **Multiple articles** (Demonstrates both definite (the) and indefinite (a) article placement):
  - Word: "the"
  - Sentence: "The cat chased a mouse."
  - Scrambled: ["chased", "a", "mouse.", "cat", "The"]

- **Question sentence** (Question word order with question mark attached to last word):
  - Word: "ready"
  - Sentence: "Are you ready?"
  - Scrambled: ["you", "ready?", "Are"]

- **Exclamation sentence** (Exclamation with punctuation attached to last word):
  - Word: "incredible"
  - Sentence: "That was incredible!"
  - Scrambled: ["was", "That", "incredible!"]

- **Sentence with comma** (Comma attached to word, period attached to last word):
  - Word: "happy"
  - Sentence: "I am tired, but happy."
  - Scrambled: ["tired,", "happy.", "I", "but", "am"]

- **Level A1** (Simple present tense, basic subject-verb-object structure):
  - Word: "like"
  - Sentence: "I like my cat."
  - Scrambled: ["my", "I", "like", "cat."]

- **Level A2** (Present continuous for future plans with time expression):
  - Word: "going"
  - Sentence: "We are going to the beach tomorrow."
  - Scrambled: ["tomorrow.", "going", "beach", "We", "the", "to", "are"]

- **Level B1** (Second conditional structure with comma placement):
  - Word: "explore"
  - Sentence: "If I had time, I would explore the jungle."
  - Scrambled: ["time,", "If", "explore", "would", "had", "jungle.", "the", "I", "I"]

- **Level B2** (Past perfect passive voice, complex temporal sequence):
  - Word: "been completed"
  - Sentence: "The project had been completed before the deadline."
  - Scrambled: ["had", "The", "been", "before", "deadline.", "completed", "project", "the"]

- **Level C1** (Formal conjunction, advanced vocabulary with comma):
  - Word: "notwithstanding"
  - Sentence: "Notwithstanding the obstacles, we persevered."
  - Scrambled: ["persevered.", "we", "Notwithstanding", "obstacles,", "the"]
