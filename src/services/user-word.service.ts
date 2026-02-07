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
import { generateText, Output, type LanguageModelUsage } from 'ai';
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

export const toTranslateEnglishSentence = async (words: WordData[]) => {
  const { output, usage } = await generateText({
    model,
    output: Output.array({
      element: z.object({
        id: z.number().describe('Each task.id matches the corresponding input word.id'),
        reasoningSteps: z.array(
          z.object({
            name: z.string(),
            text: z.string(),
          }),
        ),
        sentence: z.string().describe('English sentence containing target word/phrase'),
        translation: z
          .string()
          .describe(
            'Ukrainian translation: 3-15 words, single spaces, punctuation attached to words, first word capitalized only',
          ),
      }),
    }),
    prompt: [
      `Create exactly ${words.length} English->Ukrainian word arrangement tasks (one per input word)`,
      '',
      'Requirements:',
      '- English sentence: 3-15 words, modern, natural, containing target word/phrase',
      '- Sentences are level-appropriate: A1 simple, B1 uses conditionals/complex structures, B2+ uses advanced grammar, etc',
      '- Varied punctuation (., !, ?) based on sentence type',
      '- Ukrainian translation: natural, grammatically correct',
      '- When generating Ukrainian text, ensure adjective-noun agreement (gender, number, case)',
      '- Ukrainian translation: 3-15 words, single spaces, punctuation attached to words, first word capitalized only',
      '- Ukrainian translation must have unambiguous word order when shuffled (no two valid orderings of the words)',
      '- ALL Ukrainian words must be separate: pronouns, prepositions, conjunctions, particles',
      '',
      'Reasoning Steps:',
      '1. Analysis: Identify CEFR level and appropriate grammar structures for this word',
      '2. Generate 3 English Sentence Candidates: Write 3 sentences using the word. For each, count words explicitly (e.g., "1-She 2-has 3-a 4-new 5-car = 5 words") and check if within 3-15 range (yes/no). Punctuation marks are NOT words',
      '3. Select Best English Sentence: Choose sentence with word count 3-15, level-appropriate grammar, and natural phrasing. If none valid, generate 2 new candidates. RE-COUNT to verify 3-15 words',
      '4. Generate Ukrainian Translation: Translate selected sentence to natural, grammatically correct Ukrainian. Ensure proper verb conjugation, case agreement, and word choice. Count Ukrainian words explicitly and verify 3-15 range',
      '5. Validate Translation: Check: word count 3-15 (yes/no), single-space separated (yes/no), punctuation attached to last word only (yes/no), first word capitalized only (yes/no), unambiguous word order when shuffled (yes/no), all words are separate tokens (yes/no). If any "no", revise the translation',
      '6. Final Validation: Check all requirements: English sentence 3-15 words (yes/no), target word present (yes/no), Ukrainian translation 3-15 words (yes/no), translation accurate (yes/no), translation formatting correct (yes/no), unambiguous when shuffled (yes/no). If any "no", fix the issue',
      '',
      'Words:',
      JSON.stringify(words),
    ].join('\n'),
  });

  const tasks = removeReasoningSteps(output);

  const cost = {
    taskType: TaskType.TranslateEnglishSentence,
    costInNanoDollars: calculateCostInNanoDollars(usage),
    inputTokens: usage.inputTokens,
    outputTokens: usage.outputTokens,
  };

  return { output, tasks, cost };
};

export const toTranslateUkrainianSentence = async (words: WordData[]) => {
  const { output, usage } = await generateText({
    model,
    output: Output.array({
      element: z.object({
        id: z.number().describe('Each task.id matches the corresponding input word.id'),
        reasoningSteps: z.array(
          z.object({
            name: z.string(),
            text: z.string(),
          }),
        ),
        sentence: z.string().describe('Ukrainian sentence containing translated target word/phrase'),
        translation: z
          .string()
          .describe(
            'English translation: 3-15 words, single spaces, punctuation attached to words, first word capitalized only',
          ),
      }),
    }),
    prompt: [
      `Create exactly ${words.length} Ukrainian->English word arrangement tasks (one per input word)`,
      '',
      'Requirements:',
      '- Ukrainian sentence: 3-15 words, modern, natural, containing translated target word/phrase',
      '- Sentences are level-appropriate: A1 simple, B1 uses conditionals/complex structures, B2+ uses advanced grammar, etc',
      '- Varied punctuation (., !, ?) based on sentence type',
      '- English translation: natural, grammatically perfect, includes ALL articles (a/an/the), ALL prepositions (to/at/in/for), ALL auxiliary verbs, correct verb forms',
      '- English translation: 3-15 words, single spaces, punctuation attached to words, first word capitalized only',
      '- English translation must have unambiguous word order when shuffled (no two valid orderings of the words)',
      '- ALL English words must be separate: articles, prepositions, conjunctions, auxiliaries',
      '',
      'Reasoning Steps:',
      '1. Analysis: Identify CEFR level and appropriate grammar structures for this word',
      '2. Generate 3 Ukrainian Sentence Candidates: Write 3 sentences using the word. For each, count words explicitly (e.g., "1-Вона 2-має 3-нову 4-машину = 4 words") and check if within 3-15 range (yes/no). Punctuation marks and hyphens are NOT words',
      '3. Select Best Ukrainian Sentence: Choose sentence with word count 3-15, level-appropriate grammar, and natural phrasing. If none valid, generate 2 new candidates. RE-COUNT the selected sentence to verify 3-15 words',
      '4. Generate English Translation: Translate selected sentence to natural, grammatically correct English. Include ALL articles, prepositions, and auxiliary verbs. Count English words explicitly and verify 3-15 range',
      '5. Validate Translation: Check: word count 3-15 (yes/no), all articles present (yes/no), all prepositions present (yes/no), all auxiliaries present (yes/no), single-space separated (yes/no), punctuation attached to last word only (yes/no), first word capitalized only (yes/no), unambiguous word order when shuffled (yes/no). If any "no", revise the translation',
      '6. Final Validation: Check all requirements: Ukrainian sentence 3-15 words (yes/no), target word/phrase present (yes/no), English translation 3-15 words (yes/no), translation grammatically perfect (yes/no), translation formatting correct (yes/no), unambiguous when shuffled (yes/no). If any "no", fix the issue',
      '',
      'Words:',
      JSON.stringify(words),
    ].join('\n'),
  });

  const tasks = removeReasoningSteps(output);

  const cost = {
    taskType: TaskType.TranslateUkrainianSentence,
    costInNanoDollars: calculateCostInNanoDollars(usage),
    inputTokens: usage.inputTokens,
    outputTokens: usage.outputTokens,
  };

  return { output, tasks, cost };
};

export const getLearningTasks = async (body: AuthParams<{ limit: number }>) => {
  const learningWords = await getLearningWords(body);
  if (!learningWords.length) {
    return {
      translateEnglishSentenceTasks: [],
      translateUkrainianSentenceTasks: [],
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

  const [translateEnglishSentence, translateUkrainianSentence] = await Promise.all([
    toTranslateEnglishSentence(words),
    toTranslateUkrainianSentence(words),
  ]);

  const events = [translateEnglishSentence.cost, translateUkrainianSentence.cost].map((cost) => ({
    ...cost,
    type: EventType.TaskCost as const,
    userId: body.userId,
    userWordIds: learningWords.map(({ id }) => id),
  }));
  await insertEvents(events);

  return {
    translateEnglishSentenceTasks: translateEnglishSentence.tasks,
    translateUkrainianSentenceTasks: translateUkrainianSentence.tasks,
  };
};
