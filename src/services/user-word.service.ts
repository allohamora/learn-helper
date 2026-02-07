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
import { createGoogleGenerativeAI, type GoogleGenerativeAIProviderOptions } from '@ai-sdk/google';
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
};

export const toTranslateEnglishSentence = async (words: WordData[]) => {
  const { reasoning, output, usage } = await generateText({
    model,
    providerOptions: {
      google: {
        thinkingConfig: {
          includeThoughts: true,
          thinkingBudget: 2048,
        },
      } satisfies GoogleGenerativeAIProviderOptions,
    },
    temperature: 0.7,
    output: Output.array({
      element: z.object({
        id: z.number(),
        sentence: z.string(),
        translation: z.string(),
      }),
    }),
    prompt: [
      '<role>Act as an expert bilingual exercise writer (English-Ukrainian).</role>',
      `<task>Create exactly ${words.length} English->Ukrainian word-order tasks, one per input word.</task>`,
      '<workflow>',
      '- Build targetPattern from word: keep all non-placeholder tokens in the same order and keep each placeholder slot (sb/sth) position.',
      '- Write one English draft sentence that contains exactly one adapted target span: preserve target token order, replace every placeholder slot with real words, and apply only allowed minimal inflection/conjugation.',
      '- Write one Ukrainian draft translation for that same English sentence.',
      '- Map drafts to output fields with the same id: sentence = English draft, translation = Ukrainian draft.',
      '</workflow>',
      '<requirements>',
      '- Id: task.id matches input word.id.',
      '- English sentence: max 15 words, sentence case, natural, single sentence, and contains exactly one adapted target span (case-insensitive) that preserves target token order, replaces every placeholder with real words, and allows only minimal inflection/conjugation.',
      '- Target integrity: do not paraphrase or shorten the target phrase. Keep token order unchanged and do not drop, reorder, or replace function words (articles, prepositions, conjunctions, particles, modals).',
      '- Minimal variant is allowed only for verb/auxiliary inflection needed for agreement within the target phrase; function words must remain exact.',
      '- If target includes (sb)/(sth), replace every placeholder with real words and keep the rest of the phrase unchanged. Do not omit placeholders.',
      '- Ukrainian translation: max 15 words, sentence case, natural and grammatical.',
      '- Translation formatting: single spaces only, no leading/trailing spaces, punctuation attached to tokens (internal commas allowed; final punctuation attached).',
      '- Both fields must be single sentences. Do not use semicolons or colons, and do not join independent clauses.',
      '- Ukrainian translation must have one unambiguous order when shuffled; keep pronouns/prepositions/conjunctions/particles as separate tokens.',
      '- Ensure correct Ukrainian adjective-noun agreement (gender/number/case).',
      '</requirements>',
      `<words>${JSON.stringify(words)}</words>`,
    ].join('\n'),
  });

  const cost = {
    taskType: TaskType.TranslateEnglishSentence,
    costInNanoDollars: calculateCostInNanoDollars(usage),
    inputTokens: usage.inputTokens,
    outputTokens: usage.outputTokens,
  };

  return { reasoning, tasks: output, cost };
};

export const toTranslateUkrainianSentence = async (words: WordData[]) => {
  const { reasoning, output, usage } = await generateText({
    model,
    providerOptions: {
      google: {
        thinkingConfig: {
          includeThoughts: true,
          thinkingBudget: 2048,
        },
      } satisfies GoogleGenerativeAIProviderOptions,
    },
    temperature: 0.7,
    output: Output.array({
      element: z.object({
        id: z.number(),
        sentence: z.string(),
        translation: z.string(),
      }),
    }),
    prompt: [
      '<role>Act as an expert bilingual exercise writer (Ukrainian-English).</role>',
      `<task>Create exactly ${words.length} Ukrainian->English word-order tasks, one per input word.</task>`,
      '<workflow>',
      '- Build targetPattern from word: keep all non-placeholder tokens in the same order and keep each placeholder slot (sb/sth) position.',
      '- Write one English draft translation that contains exactly one adapted target span: preserve target token order, replace every placeholder slot with real words, and apply only allowed minimal inflection/conjugation.',
      '- Write one Ukrainian draft sentence that naturally translates to that English draft.',
      '- Map drafts to output fields with the same id: sentence = Ukrainian draft, translation = English draft.',
      '</workflow>',
      '<requirements>',
      '- Id: task.id matches input word.id.',
      '- Ukrainian sentence: max 15 words, sentence case, natural, grammatical, and single sentence.',
      '- English translation: max 15 words, sentence case, natural, single sentence, and contains exactly one adapted target span (case-insensitive) that preserves target token order, replaces every placeholder with real words, and allows only minimal inflection/conjugation.',
      '- Target integrity: do not paraphrase or shorten the target phrase. Keep token order unchanged and do not drop, reorder, or replace function words (articles, prepositions, conjunctions, particles, modals).',
      '- Minimal variant is allowed only for verb/auxiliary inflection needed for agreement within the target phrase; function words must remain exact.',
      '- If target includes (sb)/(sth), replace every placeholder with real words and keep the rest of the phrase unchanged. Do not omit placeholders.',
      '- English translation must include required articles/prepositions/auxiliaries as separate tokens, with correct a/an and verb forms.',
      '- Translation formatting: single spaces only, no leading/trailing spaces, punctuation attached to tokens (internal commas allowed; final punctuation attached).',
      '- Both fields must avoid semicolons and colons, and must not join independent clauses.',
      '- English translation must have one unambiguous order when shuffled; keep articles/prepositions/conjunctions/auxiliaries as separate tokens.',
      '</requirements>',
      `<words>${JSON.stringify(words)}</words>`,
    ].join('\n'),
  });
  const cost = {
    taskType: TaskType.TranslateUkrainianSentence,
    costInNanoDollars: calculateCostInNanoDollars(usage),
    inputTokens: usage.inputTokens,
    outputTokens: usage.outputTokens,
  };

  return { reasoning, tasks: output, cost };
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
