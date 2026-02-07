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
      '<role>Expert bilingual exercise writer (English-Ukrainian).</role>',
      `<task>Create exactly ${words.length} English->Ukrainian word-order tasks, one per input word.</task>`,
      '<workflow>',
      '1. For each word, build the target pattern from its value.',
      '2. Write an English sentence with specific real-world context.',
      '3. Translate it into natural Ukrainian a native speaker would actually say.',
      '4. Output: id = word.id, sentence = English, translation = Ukrainian.',
      '</workflow>',
      '<requirements>',
      'English sentence:',
      '- Complete sentence (subject + verb), sentence case, max 15 words.',
      '- Single sentence. No semicolons, colons, or dashes (–, —).',
      '- Must contain ALL non-placeholder tokens from the target in order.',
      '- For phrasal verbs, include every particle (e.g., "take (sb) out" requires "take" AND "out").',
      '- Only verb/auxiliary inflection allowed (e.g., "be going to" -> "is going to").',
      '- Keep all function words unchanged.',
      '- If the target is "a", place it before a consonant-starting word (not "an").',
      '- Use specific context, not vague abstract sentences.',
      'Ukrainian translation:',
      '- Max 15 words, sentence case, single sentence.',
      '- Must sound natural to a native Ukrainian speaker.',
      '- Use idiomatic Ukrainian, not word-for-word translation from English.',
      '- Single spaces, punctuation attached to tokens.',
      '- NEVER use dash characters (–, —, -) in the translation. Rephrase to avoid them.',
      '- One unambiguous word order when shuffled.',
      '- Pronouns/prepositions/conjunctions/particles as separate tokens.',
      '- Correct adjective-noun agreement (gender/number/case).',
      'Placeholders:',
      '- Replace every parenthesized placeholder with a concrete word.',
      '- Never output literal placeholder text in the sentence.',
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
      '<role>Expert bilingual exercise writer (Ukrainian-English).</role>',
      `<task>Create exactly ${words.length} Ukrainian->English word-order tasks, one per input word.</task>`,
      '<workflow>',
      '1. For each word, build the target pattern from its value.',
      '2. Write an English sentence with specific real-world context.',
      '3. Write a natural Ukrainian sentence a native speaker would actually say.',
      '4. Output: id = word.id, sentence = Ukrainian, translation = English.',
      '</workflow>',
      '<requirements>',
      'Ukrainian sentence:',
      '- Max 15 words, sentence case, grammatical, single sentence.',
      '- No semicolons or colons.',
      '- NEVER use dash characters (–, —, -) in the sentence. Rephrase to avoid them.',
      '- Must sound natural to a native Ukrainian speaker.',
      '- Use idiomatic Ukrainian, not word-for-word translation from English.',
      'English translation:',
      '- Complete sentence (subject + verb), sentence case, max 15 words.',
      '- Single sentence. No semicolons, colons, or dashes (–, —).',
      '- Must contain ALL non-placeholder tokens from the target in order.',
      '- For phrasal verbs, include every particle (e.g., "take (sb) out" requires "take" AND "out").',
      '- Only verb/auxiliary inflection allowed (e.g., "be going to" -> "is going to").',
      '- Keep all function words unchanged.',
      '- If the target is "a", place it before a consonant-starting word (not "an").',
      '- Use specific context, not vague abstract sentences.',
      '- Include required articles/prepositions/auxiliaries as separate tokens.',
      '- Single spaces, punctuation attached to tokens.',
      '- One unambiguous word order when shuffled.',
      'Placeholders:',
      '- Replace every parenthesized placeholder with a concrete word.',
      '- Never output literal placeholder text in the translation.',
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
