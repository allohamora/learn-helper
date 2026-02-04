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

const providerOptions = {
  google: {
    thinkingConfig: {
      includeThoughts: true,
      thinkingBudget: 512,
    },
  } as GoogleGenerativeAIProviderOptions,
};

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

export const toFillInTheGap = async (words: WordData[]) => {
  const { reasoning, output, usage } = await generateText({
    model,
    output: Output.array({
      element: z.object({
        id: z.number(),
        task: z.string(),
        answer: z.string(),
      }),
    }),
    providerOptions,
    prompt: [
      '<role>Act as an expert English exercise writer (fill-in-the-gap)</role>',
      `<task>Create exactly ${words.length} tasks, one per input word</task>`,
      '<requirements>',
      '- task.id matches input word.id',
      '- Sentence: 3-15 words, natural, modern, and grammatically correct, with exactly one "___" blank; target word appears only in the blank',
      '- Use appropriate punctuation (., !, ?) for sentence type; avoid adding punctuation that is not needed for meaning',
      '- Keep tasks unique across the list (avoid repeating sentence structures, topics, or contexts)',
      '- Make scenarios interesting and relatable; prefer conversational English over formal or outdated expressions',
      '- If the target includes placeholders like "(sb)" or "(sth)", adapt naturally (e.g., "I ___ you")',
      '- For articles (a/an), ensure the following word requires the correct article based on sound',
      '- For function words (articles, prepositions, conjunctions, modals), create contexts where the specific word is required, not interchangeable',
      '- Answer: exact target word/phrase in the correct form (case-insensitive)',
      '</requirements>',
      `<words>${JSON.stringify(words)}</words>`,
    ].join('\n'),
  });

  const cost = {
    taskType: TaskType.FillInTheGap,
    costInNanoDollars: calculateCostInNanoDollars(usage),
    inputTokens: usage.inputTokens,
    outputTokens: usage.outputTokens,
  };

  return { reasoning, output, tasks: output, cost };
};

export const toTranslateEnglishSentence = async (words: WordData[]) => {
  const { reasoning, output, usage } = await generateText({
    model,
    output: Output.array({
      element: z.object({
        id: z.number(),
        sentence: z.string(),
        translation: z.string(),
      }),
    }),
    providerOptions,
    prompt: [
      '<role>Act as an expert bilingual teacher (English-Ukrainian)</role>',
      `<task>Create exactly ${words.length} English->Ukrainian word-order tasks, one per input word</task>`,
      '<requirements>',
      '- task.id matches input word.id',
      '- English sentence: 3-15 words, natural, contains target word/phrase, with appropriate punctuation, first letter uppercase',
      '- Ukrainian translation: natural and grammatically correct, 3-15 words, single spaces, punctuation attached, first word capitalized only',
      '- Use statements (.), questions (?), and exclamations (!) when appropriate',
      '- Avoid adding trailing periods purely for formatting; punctuation should be meaningful because trailing periods may be stripped before shuffling',
      '- Ukrainian translation must have a single valid word order when shuffled; all words are separate tokens',
      '- Keep pronouns, prepositions, conjunctions, and particles as separate tokens',
      '- Ensure correct Ukrainian adjective-noun agreement (gender, number, case)',
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

  return { reasoning, output, tasks: output, cost };
};

export const toTranslateUkrainianSentence = async (words: WordData[]) => {
  const { reasoning, output, usage } = await generateText({
    model,
    output: Output.array({
      element: z.object({
        id: z.number(),
        sentence: z.string(),
        translation: z.string(),
      }),
    }),
    providerOptions,
    prompt: [
      '<role>Act as an expert bilingual teacher (Ukrainian-English)</role>',
      `<task>Create exactly ${words.length} Ukrainian->English word-order tasks, one per input word</task>`,
      '<requirements>',
      '- task.id matches input word.id',
      '- Ukrainian sentence: 3-15 words, natural, contains the translated target word/phrase, with appropriate punctuation, first letter uppercase',
      '- English translation: natural and grammatically correct, includes required articles/prepositions/auxiliaries, 3-15 words, single spaces, punctuation attached, first word capitalized only',
      '- Use statements (.), questions (?), and exclamations (!) when appropriate',
      '- Avoid adding trailing periods purely for formatting; punctuation should be meaningful because trailing periods may be stripped before shuffling',
      '- Use correct English verb forms',
      '- English translation must have a single valid word order when shuffled; all words are separate tokens',
      '- Keep articles, prepositions, conjunctions, and auxiliaries as separate tokens',
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

  return { reasoning, output, tasks: output, cost };
};

export const toSynonymAndAntonym = async (words: WordData[]) => {
  const { reasoning, output, usage } = await generateText({
    model,
    output: Output.array({
      element: z.object({
        id: z.number(),
        synonym: z.string(),
        antonym: z.string(),
      }),
    }),
    providerOptions,
    prompt: [
      '<role>Act as an expert English lexicographer (synonym/antonym)</role>',
      `<task>Create exactly ${words.length} synonym/antonym pairs, one per input word</task>`,
      '<requirements>',
      '- task.id matches input word.id',
      '- Same part of speech; for function words, keep the same category (article/preposition/modal/etc.)',
      '- Do not use the target word itself',
      '- Use real words/phrases only (no placeholders like "N/A")',
      '- If no exact match, use near-synonyms or functional opposites',
      '- Use common, clear vocabulary; single words or short phrases are acceptable',
      '</requirements>',
      `<words>${JSON.stringify(words)}</words>`,
    ].join('\n'),
  });

  const cost = {
    taskType: TaskType.SynonymAndAntonym,
    costInNanoDollars: calculateCostInNanoDollars(usage),
    inputTokens: usage.inputTokens,
    outputTokens: usage.outputTokens,
  };

  return { reasoning, output, tasks: output, cost };
};

export const getLearningTasks = async (body: AuthParams<{ limit: number }>) => {
  const learningWords = await getLearningWords(body);
  if (!learningWords.length) {
    return {
      fillInTheGapTasks: [],
      translateEnglishSentenceTasks: [],
      translateUkrainianSentenceTasks: [],
      synonymAndAntonymTasks: [],
    };
  }

  const words = learningWords.map(
    ({ id, word }): WordData => ({
      id,
      value: word.value,
      partOfSpeech: word.partOfSpeech,
    }),
  );

  const [fillInTheGap, translateEnglishSentence, translateUkrainianSentence, synonymAndAntonym] = await Promise.all([
    toFillInTheGap(words),
    toTranslateEnglishSentence(words),
    toTranslateUkrainianSentence(words),
    toSynonymAndAntonym(words),
  ]);

  const events = [
    fillInTheGap.cost,
    translateEnglishSentence.cost,
    translateUkrainianSentence.cost,
    synonymAndAntonym.cost,
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
  };
};
