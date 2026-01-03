import {
  decreaseMaxWordsToUnlock,
  getMaxWordsToUnlock,
  getUserWordById,
  updateUserWord,
  updateUserWordStatus,
} from '@/repositories/user-word.repository';
import type { AuthParams } from '@/types/auth.types';
import { Status, TaskType, type DiscoveryStatus } from '@/types/user-words.types';
import { EventType } from '@/types/event.types';
import { db } from 'astro:db';
import { generateObject, type LanguageModelUsage } from 'ai';
import { createGoogleGenerativeAI } from '@ai-sdk/google';
import { z } from 'zod';
import { GEMINI_API_KEY } from 'astro:env/server';
import { getLearningWords } from '@/repositories/user-word.repository';
import { deleteWordDiscoveredEvents, insertEvent, insertEvents } from '@/repositories/event.repository';

const REVIEW_AFTER_VALUE = 3;
const MAX_ENCOUNTER_COUNT = 3;

export const moveUserWordToNextStep = async (data: AuthParams<{ userWordId: number }>) => {
  await db.transaction(async (tx) => {
    const userWord = await getUserWordById(data, tx);
    const encounterCount = userWord.encounterCount + 1;

    await insertEvent({ type: EventType.WordMovedToNextStep, ...data }, tx);
    await decreaseMaxWordsToUnlock(data, tx);

    if (encounterCount >= MAX_ENCOUNTER_COUNT) {
      await updateUserWord({ ...data, wordsToUnlock: 0, encounterCount, status: Status.Learned }, tx);
    } else {
      const maxWordsToUnlock = await getMaxWordsToUnlock(data, tx);

      await updateUserWord({ ...data, wordsToUnlock: maxWordsToUnlock + REVIEW_AFTER_VALUE, encounterCount }, tx);
    }
  });
};

export const setDiscoveryStatus = async (
  data: AuthParams<
    { userWordId: number } & (
      | { status: Status.Waiting }
      | { status: Exclude<DiscoveryStatus, Status.Waiting>; durationMs: number }
    )
  >,
) => {
  await db.transaction(async (tx) => {
    if (data.status === Status.Waiting) {
      await deleteWordDiscoveredEvents(data, tx);
    } else {
      await insertEvent(
        {
          type: EventType.WordDiscovered,
          ...data,
        },
        tx,
      );
    }

    await updateUserWordStatus(data, tx);
  });
};

const google = createGoogleGenerativeAI({
  apiKey: GEMINI_API_KEY,
});

const model = google('gemini-2.5-flash-lite');

const INPUT_NANO_DOLLARS_PER_TOKEN = 100;
const OUTPUT_NANO_DOLLARS_PER_TOKEN = 400;

const calculateCostInNanoDollars = ({ inputTokens = 0, outputTokens = 0 }: LanguageModelUsage) => {
  const inputCostInNanoDollars = inputTokens * INPUT_NANO_DOLLARS_PER_TOKEN;
  const outputCostInNanoDollars = outputTokens * OUTPUT_NANO_DOLLARS_PER_TOKEN;

  return inputCostInNanoDollars + outputCostInNanoDollars;
};

export type WordData = {
  id: number;
  value: string;
  partOfSpeech: string | null;
  level: string;
  definition: string;
};

const removeReasoningSteps = <T extends { reasoningSteps: unknown }>(items: T[]) => {
  return items.map(({ reasoningSteps, ...rest }) => rest);
};

export const toFillInTheGap = async (words: WordData[]) => {
  const { object, usage } = await generateObject({
    model,
    schema: z.array(
      z.object({
        id: z.number().describe('Each task.id matches the corresponding input word.id'),
        reasoningSteps: z.array(
          z.object({
            name: z.string(),
            text: z.string(),
          }),
        ),
        task: z.string().describe('3-15 word sentence with exactly one "___" blank replacing target word'),
        answer: z.string().describe('Exact word/phrase adapted grammatically (case-insensitive)'),
      }),
    ),
    prompt: [
      `Create exactly ${words.length} fill-in-the-gap exercises (one per input word)`,
      '',
      'Requirements:',
      '- Grammatically correct, natural, engaging and modern English sentences',
      '- Target word appears ONLY as "___" blank',
      '- Sentences are level-appropriate: A1 simple, B1 uses conditionals/complex structures, B2+ uses advanced grammar, etc',
      '- Varied punctuation (., !, ?) based on sentence type',
      '',
      'Reasoning Steps:',
      '1. Analysis: Identify CEFR level and appropriate grammar structures for this word',
      '2. Generate 3 Sentence Candidates: Write 3 complete sentences using the word. For each, count words explicitly (e.g., "1-She 2-has 3-a 4-new 5-car = 5 words") and check if within 3-15 range (yes/no)',
      '3. Validate Each: For all 3 candidates check: word count 3-15 (yes/no), level-appropriate grammar (yes/no), natural English (yes/no), target word present (yes/no)',
      '4. Select Best: Choose sentence with most "yes" validations. If no candidate has all "yes", generate 2 new candidates and validate. Select the best valid option',
      '5. Create Task: Replace target word with "___", ensuring the task sentence (with blank) is 3-15 words. The answer must be grammatically adapted to fit the blank.',
      '6. Final Validation: Check all requirements: task sentence 3-15 words (yes/no), exactly one ___ blank (yes/no), answer fills blank grammatically (yes/no), target word only in blank (yes/no), level-appropriate (yes/no). If any "no", fix the issue',
      '',
      'Words:',
      JSON.stringify(words),
    ].join('\n'),
  });

  const tasks = removeReasoningSteps(object);

  const cost = {
    taskType: TaskType.FillInTheGap,
    costInNanoDollars: calculateCostInNanoDollars(usage),
    inputTokens: usage.inputTokens,
    outputTokens: usage.outputTokens,
  };

  return { object, tasks, cost };
};

export const toTranslateEnglishSentence = async (words: WordData[]) => {
  const { object, usage } = await generateObject({
    model,
    schema: z.array(
      z.object({
        id: z.number().describe('Each task.id matches the corresponding input word.id'),
        reasoningSteps: z.array(
          z.object({
            name: z.string(),
            text: z.string(),
          }),
        ),
        sentence: z.string().describe('English sentence containing target word/phrase'),
        options: z
          .array(
            z.object({
              value: z.string().describe('Complete Ukrainian sentence'),
              isAnswer: z.boolean().describe('true for 1 correct option, false for 3 wrong options'),
              description: z.string().optional().describe('ONLY wrong options (isAnswer: false) have description'),
            }),
          )
          .describe('4 options: 1 correct, 3 wrong'),
      }),
    ),
    prompt: [
      `Create exactly ${words.length} English->Ukrainian translation tasks (one per input word)`,
      '',
      'Requirements:',
      '- English sentence: 3-15 words, modern, natural',
      '- ALL Ukrainian options MUST be complete sentences with subject (pronoun/noun) and conjugated verb',
      '- ALL options: grammatically perfect with full agreement (possessives match noun case AND number, verbs match subject gender/number, nouns in correct case)',
      '- Wrong options differ semantically (wrong noun/tense/subject), NOT grammatically.',
      '- Correct option: precisely translates English sentence',
      '- Wrong options: grammatically complete sentences that differ by ONE word substitution (wrong tense/subject/noun/verb).',
      '- Sentences are level-appropriate: A1 simple, B1 uses conditionals/complex structures, B2+ uses advanced grammar, etc',
      '- When generating Ukrainian text, always ensure adjective–noun agreement',
      '- Adjectives must match the noun in gender, number, and case',
      '- Do not use synonyms of the target word in any option',
      '- Do not have multiple options that are acceptable translations of the English sentence',
      "- ONLY wrong options (isAnswer: false) have description: \"Wrong [category]: '[incorrect word]' instead of '[correct word]'\" - reference specific words, not full sentences",
      '',
      'Reasoning Steps:',
      '1. Analysis: Identify CEFR level and appropriate grammar structures for this word',
      '2. Generate 3 English Sentence Candidates: Write 3 sentences using the word. For each, count words explicitly (e.g., "1-She 2-has 3-a 4-new 5-car = 5 words") and check if within 3-15 range (yes/no). Punctuation marks are NOT words',
      '3. Select Best English Sentence: Choose sentence with word count 3-15, level-appropriate grammar, and natural phrasing. If none valid, generate 2 new candidates. RE-COUNT to verify 3-15 words',
      '4. Generate 4 Ukrainian Options: 1 correct translation + 3 wrong options. Each wrong option must be a grammatically perfect sentence with ONE semantically different word (different noun/verb/adjective). Add word-specific descriptions',
      '5. Validate Grammar: For EACH of the 4 Ukrainian options, check: has subject (yes/no), has conjugated verb (yes/no), nouns in correct case (yes/no), verb agrees with subject gender/number (yes/no), grammatically perfect (yes/no). If any "no", fix the grammatical error while keeping the semantic difference. Example: "Я бачив кішка" → "Я бачив кішку"',
      '6. Final Validation: Check all requirements: English sentence 3-15 words (yes/no), exactly 4 options (yes/no), all 4 options grammatically complete sentences (yes/no), exactly 1 correct option (yes/no), all 3 wrong options have word-specific descriptions (yes/no), no synonyms used (yes/no). If any "no", fix the issue',
      '',
      'Words:',
      JSON.stringify(words),
    ].join('\n'),
  });

  const tasks = removeReasoningSteps(object);

  const cost = {
    taskType: TaskType.TranslateEnglishSentence,
    costInNanoDollars: calculateCostInNanoDollars(usage),
    inputTokens: usage.inputTokens,
    outputTokens: usage.outputTokens,
  };

  return { object, tasks, cost };
};

export const toTranslateUkrainianSentence = async (words: WordData[]) => {
  const { object, usage } = await generateObject({
    model,
    schema: z.array(
      z.object({
        id: z.number().describe('Each task.id matches the corresponding input word.id'),
        reasoningSteps: z.array(
          z.object({
            name: z.string(),
            text: z.string(),
          }),
        ),
        sentence: z.string().describe('Ukrainian sentence containing translated target word/phrase'),
        options: z
          .array(
            z.object({
              value: z.string().describe('Complete English sentence'),
              isAnswer: z.boolean().describe('true for 1 correct option, false for 3 wrong options'),
              description: z.string().optional().describe('ONLY wrong options (isAnswer: false) have description'),
            }),
          )
          .describe('4 options: 1 correct, 3 wrong'),
      }),
    ),
    prompt: [
      `Create exactly ${words.length} Ukrainian->English translation tasks (one per input word)`,
      '',
      'Requirements:',
      '- Ukrainian sentence: 3-15 words, modern, natural',
      '- ALL English options must be grammatically perfect sentences: include all articles (a/an/the), all prepositions (to/at/in), all necessary words, correct verb forms',
      '- Correct option: precisely translates Ukrainian sentence',
      '- Wrong options differ semantically (wrong noun/tense/subject), NOT grammatically. Examples: VALID: "He is buying" vs "He was buying" (tense change, both grammatical), INVALID: "They are going buy" (missing "to" - grammatically wrong), "They going to buy" (missing "are" - grammatically wrong)',
      '- Sentences are level-appropriate: A1 simple, B1 uses conditionals/complex structures, B2+ uses advanced grammar, etc',
      '- Do not use synonyms of the target word in any option',
      '- Do not have multiple options that are acceptable translations of the English sentence',
      "- ONLY wrong options (isAnswer: false) have description: \"Wrong [category]: '[incorrect word]' instead of '[correct word]'\" - reference specific words, not full sentences",
      '',
      'Reasoning Steps:',
      '1. Analysis: Identify CEFR level and appropriate grammar structures for this word',
      '2. Generate 3 Ukrainian Sentence Candidates: Write 3 sentences using the word. For each, count words explicitly (e.g., "1-Вона 2-має 3-нову 4-машину = 4 words") and check if within 3-15 range (yes/no). Punctuation marks and hyphens are NOT words',
      '3. Select Best Ukrainian Sentence: Choose sentence with word count 3-15, level-appropriate grammar, and natural phrasing. If none valid, generate 2 new candidates. RE-COUNT the selected sentence to verify 3-15 words',
      '4. Generate 4 English Options: 1 correct translation + 3 wrong options. Each wrong option must be a grammatically perfect sentence with ONE semantically different word (different noun/verb/tense). Add word-specific descriptions',
      '5. Validate Grammar: For EACH of the 4 English options, check: has all articles (yes/no), has all prepositions (yes/no), has all verbs (yes/no), correct verb forms (yes/no), grammatically perfect (yes/no). If any "no", fix the grammatical error while keeping the semantic difference. Example: "They are going buy" → "They are going to buy"',
      '6. Final Validation: Check all requirements: Ukrainian sentence 3-15 words (yes/no), exactly 4 options (yes/no), all 4 options grammatically complete sentences (yes/no), exactly 1 correct option (yes/no), all 3 wrong options have word-specific descriptions (yes/no), no synonyms used (yes/no). If any "no", fix the issue',
      '',
      'Words:',
      JSON.stringify(words),
    ].join('\n'),
  });

  const tasks = removeReasoningSteps(object);

  const cost = {
    taskType: TaskType.TranslateUkrainianSentence,
    costInNanoDollars: calculateCostInNanoDollars(usage),
    inputTokens: usage.inputTokens,
    outputTokens: usage.outputTokens,
  };

  return { object, tasks, cost };
};

export const toSynonymAndAntonym = async (words: WordData[]) => {
  const { object, usage } = await generateObject({
    model,
    schema: z.array(
      z.object({
        id: z.number().describe('Each task.id matches the corresponding input word.id'),
        reasoningSteps: z.array(
          z.object({
            name: z.string(),
            text: z.string(),
          }),
        ),
        synonym: z.string(),
        antonym: z.string(),
      }),
    ),
    prompt: [
      `Create exactly ${words.length} synonym/antonym pairs based on the definition field (one per input word)`,
      '',
      'Requirements:',
      '- Same part of speech as input word',
      '- Match CEFR level: A1 words need simple synonyms (glad, large), not advanced (elated, substantial)',
      '- Use "definition" for meaning, but preserve part of speech',
      '- Never use target word itself',
      '- Use only words from the same category: modal -> modal, article -> article, preposition -> preposition',
      '- Never substitute with content words (adjectives, verbs, nouns)',
      '- Both synonym and antonym must be actual words or phrases derived from the word\'s definition and part of speech; never use placeholders like "N/A", "none", "nothing", "no synonym", "no antonym"',
      '- If no exact match exists at target level, use alternatives: near-synonyms, gradable antonyms, or functional opposites',
      '',
      'Reasoning Steps:',
      "1. Analysis: Examine word's part of speech, CEFR level, and core meaning from definition",
      '2. Generate 3 Synonym Candidates + 3 Antonym Candidates: List 3 different options for each',
      '3. Validate Each: For all 6 candidates check: part of speech matches (yes/no), CEFR level appropriate (yes/no), not target word (yes/no), not a placeholder like "N/A", "none", "nothing", "no synonym" (yes/no), valid English word/phrase (yes/no)',
      '4. Select Best Pair: Choose synonym and antonym with most "yes" validations. If no candidate has all "yes", generate 2 new candidates and validate. If still none, use near-synonym or functional opposite. Never output: N/A, none, nothing, no synonym, no antonym',
      '5. Final Validation: Check all requirements: synonym is actual word/phrase (yes/no), antonym is actual word/phrase (yes/no), both same part of speech as target (yes/no), both CEFR-appropriate (yes/no), neither is target word (yes/no), no placeholders like N/A/none (yes/no). If any "no", fix the issue',
      '',
      'Words:',
      JSON.stringify(words),
    ].join('\n'),
  });

  const tasks = removeReasoningSteps(object);

  const cost = {
    taskType: TaskType.SynonymAndAntonym,
    costInNanoDollars: calculateCostInNanoDollars(usage),
    inputTokens: usage.inputTokens,
    outputTokens: usage.outputTokens,
  };

  return { object, tasks, cost };
};

export const toFindNonsenseSentence = async (words: WordData[]) => {
  const { object, usage } = await generateObject({
    model,
    schema: z.array(
      z.object({
        id: z.number().describe('Each task.id matches the corresponding input word.id'),
        reasoningSteps: z.array(
          z.object({
            name: z.string(),
            text: z.string(),
          }),
        ),
        options: z.array(
          z
            .object({
              value: z.string().describe('Sentence (3-15 words, modern, natural) containing EXACT target word/phrase'),
              isAnswer: z.boolean().describe('true for 1 nonsense sentence, false for 3 correct sentences'),
              description: z
                .string()
                .optional()
                .describe('Nonsense sentence (isAnswer: true) MUST have description field explaining why it is wrong'),
            })
            .describe('4 options: 1 nonsense, 3 correct'),
        ),
      }),
    ),
    prompt: [
      `Create exactly ${words.length} nonsense detection tasks (one per input word)`,
      '',
      'Requirements:',
      '- Correct sentences: natural, grammatically perfect, contain exact target word/phrase',
      '- Nonsense sentence: obviously absurd but MUST contain exact target word/phrase',
      '- Level-appropriate grammar; varied punctuation (., !, ?)',
      '',
      'Nonsense types:',
      '- Semantic absurdity: "The chair can swim very fast."',
      '- Logical impossibility: "I will do it yesterday."',
      '- Category mistakes: "The silence can taste purple."',
      '- Grammatical breakdown: "The book agrees with on the table."',
      '',
      'Reasoning Steps:',
      '1. Analysis: Identify CEFR level and appropriate grammar structures for this word',
      '2. Generate 4-5 Correct Sentence Candidates: Write natural sentences using exact target word. For each, count words explicitly (e.g., "1-This 2-is 3-a 4-lovely 5-day = 5 words") and check if within 3-15 range (yes/no)',
      '3. Generate 2-3 Nonsense Sentence Candidates: Write absurd sentences using exact target word with nonsense type. For each, count words and check if within 3-15 range (yes/no)',
      '4. Validate All: For all candidates check: word count 3-15 (yes/no), contains exact target word (yes/no), grammatically valid structure (yes/no for correct, can be no for nonsense)',
      '5. Select Best: Pick 3 correct sentences + 1 nonsense sentence with best validation. Add description to nonsense explaining why it is wrong. If not enough valid options, generate new candidates',
      '6. Final Validation: Check all requirements: exactly 4 options (yes/no), all 3-15 words (yes/no), all contain exact target word (yes/no), exactly 1 nonsense with description (yes/no), 3 correct natural sentences (yes/no). If any "no", fix the issue',
      '',
      'Words:',
      JSON.stringify(words),
    ].join('\n'),
  });

  const tasks = removeReasoningSteps(object);

  const cost = {
    taskType: TaskType.FindNonsenseSentence,
    costInNanoDollars: calculateCostInNanoDollars(usage),
    inputTokens: usage.inputTokens,
    outputTokens: usage.outputTokens,
  };

  return { object, tasks, cost };
};

export const toWordOrder = async (words: WordData[]) => {
  const { object, usage } = await generateObject({
    model,
    schema: z.array(
      z.object({
        id: z.number().describe('Each task.id matches the corresponding input word.id'),
        reasoningSteps: z.array(
          z.object({
            name: z.string(),
            text: z.string(),
          }),
        ),
        sentence: z
          .string()
          .describe('3-15 words, single spaces, punctuation attached to words, first word capitalized only'),
        hint: z.string().describe('Ukrainian translation of the sentence'),
      }),
    ),
    prompt: [
      `Create exactly ${words.length} tasks word order exercises (one per input word)`,
      '',
      'Requirements:',
      '- Generate a sentence in CORRECT word order for each word/phrase',
      '- Add adjectives, adverbs, time expressions to reach minimum word count',
      '- All words separate: articles, prepositions, function words',
      '- Level-appropriate grammar; varied punctuation (., !, ?)',
      '- Provide Ukrainian translation as hint: natural, grammatically perfect',
      '',
      'Reasoning Steps:',
      '1. Analysis: Identify CEFR level and appropriate grammar structures for this word',
      '2. Generate 3 Sentence Candidates: Write sentences using the word. For each, count words explicitly (e.g., "1-I 2-saw 3-a 4-cute 5-little 6-cat = 6 words") and check if within 3-15 range (yes/no)',
      '3. Validate Each: For all 3 candidates check: word count 3-15 (yes/no), natural phrasing (yes/no), unambiguous when shuffled (yes/no), level-appropriate (yes/no)',
      '4. Select Best: Choose sentence with most "yes" validations. If no candidate has all "yes", generate 2 new candidates and validate. Select the best valid option',
      '5. Generate Ukrainian Hint: Translate selected sentence to natural, grammatically correct Ukrainian. Use standard Ukrainian spelling and vocabulary. Ensure proper verb conjugation, case agreement, and word choice',
      '6. Final Validation: Check all requirements: English sentence 3-15 words (yes/no), first word capitalized (yes/no), words single-space separated (yes/no), punctuation attached to words (yes/no), target word present (yes/no), Ukrainian hint verified correct (yes/no). If any "no", fix the issue',
      '',
      'Words:',
      JSON.stringify(words),
    ].join('\n'),
  });

  const tasks = removeReasoningSteps(object);

  const cost = {
    taskType: TaskType.WordOrder,
    costInNanoDollars: calculateCostInNanoDollars(usage),
    inputTokens: usage.inputTokens,
    outputTokens: usage.outputTokens,
  };

  return { object, tasks, cost };
};

export const getLearningTasks = async (body: AuthParams<{ limit: number }>) => {
  const learningWords = await getLearningWords(body);
  if (!learningWords.length) {
    return {
      fillInTheGapTasks: [],
      translateEnglishSentenceTasks: [],
      translateUkrainianSentenceTasks: [],
      synonymAndAntonymTasks: [],
      findNonsenseSentenceTasks: [],
      wordOrderTasks: [],
    };
  }

  const words = learningWords.map(
    ({ id, word }): WordData => ({
      id,
      value: word.value,
      partOfSpeech: word.partOfSpeech,
      level: word.level,
      definition: word.definition,
    }),
  );

  const [
    fillInTheGap,
    translateEnglishSentence,
    translateUkrainianSentence,
    synonymAndAntonym,
    findNonsenseSentence,
    wordOrder,
  ] = await Promise.all([
    toFillInTheGap(words),
    toTranslateEnglishSentence(words),
    toTranslateUkrainianSentence(words),
    toSynonymAndAntonym(words),
    toFindNonsenseSentence(words),
    toWordOrder(words),
  ]);

  const events = [
    fillInTheGap.cost,
    translateEnglishSentence.cost,
    translateUkrainianSentence.cost,
    synonymAndAntonym.cost,
    findNonsenseSentence.cost,
    wordOrder.cost,
  ].map((cost) => ({
    ...cost,
    type: EventType.TaskCost as const,
    userId: body.userId,
    userWordIds: learningWords.map(({ id }) => id),
  }));
  await insertEvents(events);

  return {
    fillInTheGapTasks: fillInTheGap.tasks,
    translateEnglishSentenceTasks: translateEnglishSentence.tasks,
    translateUkrainianSentenceTasks: translateUkrainianSentence.tasks,
    synonymAndAntonymTasks: synonymAndAntonym.tasks,
    findNonsenseSentenceTasks: findNonsenseSentence.tasks,
    wordOrderTasks: wordOrder.tasks,
  };
};
