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
};

export const toFillInTheGap = async (words: WordData[]) => {
  const { output, usage } = await generateText({
    model,
    output: Output.array({
      element: z.object({
        id: z.number(),
        task: z.string(),
        answer: z.string(),
      }),
    }),
    prompt: [
      '<role>Act as an expert English exercise writer focused on fill-in-the-gap practice</role>',
      `<task>Create exactly ${words.length} fill-in-the-gap exercises (one per input word)</task>`,
      '<requirements>',
      '- Each task.id matches the corresponding input word.id',
      '- Grammatically correct, natural, engaging and modern English sentences',
      '- Target word appears ONLY as "___" blank',
      '- Varied punctuation (., !, ?) based on sentence type',
      '- Task: 3-15 word sentence with exactly one "___" blank replacing target word',
      '- Answer: exact word/phrase adapted grammatically (case-insensitive)',
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

  return { output, tasks: output, cost };
};

export const toTranslateEnglishSentence = async (words: WordData[]) => {
  const { output, usage } = await generateText({
    model,
    output: Output.array({
      element: z.object({
        id: z.number(),
        sentence: z.string(),
        translation: z.string(),
      }),
    }),
    prompt: [
      '<role>Act as an expert bilingual (English-Ukrainian) language teacher creating word-arrangement exercises.</role>',
      `<task>Create exactly ${words.length} English->Ukrainian word arrangement tasks (one per input word)</task>`,
      '<requirements>',
      '- Each task.id matches the corresponding input word.id',
      '- English sentence: 3-15 words, modern, natural, containing target word/phrase',
      '- Varied punctuation (., !, ?) based on sentence type',
      '- Ukrainian translation: natural, grammatically correct',
      '- When generating Ukrainian text, ensure adjective-noun agreement (gender, number, case)',
      '- Ukrainian translation: 3-15 words, single spaces, punctuation attached to words, first word capitalized only',
      '- Ukrainian translation must have unambiguous word order when shuffled (no two valid orderings of the words)',
      '- ALL Ukrainian words must be separate: pronouns, prepositions, conjunctions, particles',
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

  return { output, tasks: output, cost };
};

export const toTranslateUkrainianSentence = async (words: WordData[]) => {
  const { output, usage } = await generateText({
    model,
    output: Output.array({
      element: z.object({
        id: z.number(),
        sentence: z.string(),
        translation: z.string(),
      }),
    }),
    prompt: [
      '<role>Act as an expert bilingual (Ukrainian-English) language teacher creating word-arrangement exercises.</role>',
      `<task>Create exactly ${words.length} Ukrainian->English word arrangement tasks (one per input word)</task>`,
      '<requirements>',
      '- Each task.id matches the corresponding input word.id',
      '- Ukrainian sentence: 3-15 words, modern, natural, containing translated target word/phrase',
      '- Varied punctuation (., !, ?) based on sentence type',
      '- English translation: natural, grammatically perfect, includes ALL articles (a/an/the), ALL prepositions (to/at/in/for), ALL auxiliary verbs, correct verb forms',
      '- English translation: 3-15 words, single spaces, punctuation attached to words, first word capitalized only',
      '- English translation must have unambiguous word order when shuffled (no two valid orderings of the words)',
      '- ALL English words must be separate: articles, prepositions, conjunctions, auxiliaries',
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

  return { output, tasks: output, cost };
};

export const toSynonymAndAntonym = async (words: WordData[]) => {
  const { output, usage } = await generateText({
    model,
    output: Output.array({
      element: z.object({
        id: z.number(),
        synonym: z.string(),
        antonym: z.string(),
      }),
    }),
    prompt: [
      '<role>Act as an expert English lexicographer generating synonym/antonym pairs.</role>',
      `<task>Create exactly ${words.length} synonym/antonym pairs based on the input word value (one per input word)</task>`,
      '<requirements>',
      '- Each task.id matches the corresponding input word.id',
      '- Same part of speech as input word',
      '- Use only word meaning from the word value and preserve part of speech',
      '- Never use target word itself',
      '- Use only words from the same category: modal -> modal, article -> article, preposition -> preposition',
      '- Never substitute with content words (adjectives, verbs, nouns)',
      '- Both synonym and antonym must be actual words or phrases derived from the word\'s definition and part of speech; never use placeholders like "N/A", "none", "nothing", "no synonym", "no antonym"',
      '- If no exact match exists at target level, use alternatives: near-synonyms, gradable antonyms, or functional opposites',
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

  return { output, tasks: output, cost };
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
