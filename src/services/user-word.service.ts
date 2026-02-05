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

export const toFillInTheGap = async (words: WordData[]) => {
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
        answer: z.string(),
        task: z.string(),
      }),
    }),
    prompt: [
      '<role>Act as an expert English exercise writer for fill-in-the-gap tasks.</role>',
      `<task>Create exactly ${words.length} tasks, one per input word, using the split workflow below.</task>`,
      '<workflow>',
      '- For each word, first create one natural draft sentence that contains the target phrase exactly once.',
      '- Put each draft in reasoning/thought summary as: id + draftSentence.',
      '- Then split that same draft into output fields: answer = the target span, task = draft with that span replaced by "___".',
      '- Do not invent a new sentence after splitting; output must come from the draft sentence.',
      '</workflow>',
      '<requirements>',
      '- Id: task.id matches input word.id.',
      '- Task: one natural, modern sentence (max 15 words) with exactly one "___" blank; single sentence only; no semicolons or colons.',
      '- Filled task (replace ___ with answer) must be grammatical and natural. The target appears only in the blank, with no identical adjacent words after filling.',
      '- Answer: start from input word/phrase and remove (sb)/(sth). Allow only necessary inflection/conjugation; do not swap or drop other words. If target contains "be", output am/is/are/was/were (never bare "be").',
      '- If target has (sb)/(sth), replace placeholders with real words outside the blank. You may omit only a trailing placeholder when still grammatical.',
      '- Keep phrase role natural in context (e.g., "for the first time" should be used adverbially, not as a noun phrase).',
      '- For a/an, the next word must require that article by sound. For other function words, build context where only the exact target fits.',
      '- Vary structures and topics across tasks.',
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
      '- For each input item, write a planning row with (id, word, partOfSpeech).',
      '- Build targetUsed from word: remove only (sb)/(sth). Keep all other words in the same order.',
      '- Write one English draft sentence that contains targetUsed exactly once as a contiguous span.',
      '- Write one Ukrainian draft translation for that same English sentence.',
      '- Map drafts to output fields with the same id: sentence = English draft, translation = Ukrainian draft.',
      '- In reasoning/thought summary, show compact per-item logs: id, word, partOfSpeech, targetUsed, sentence.',
      '</workflow>',
      '<requirements>',
      '- Id: task.id matches input word.id.',
      '- English sentence: max 15 words, sentence case, natural, single sentence, and contains targetUsed exactly once (case-insensitive).',
      '- Target integrity: do not paraphrase or shorten the target phrase. Do not drop, reorder, or replace function words (articles, prepositions, conjunctions, particles, modals).',
      '- Minimal variant is allowed only for verb/auxiliary inflection needed for agreement within the target phrase.',
      '- If target includes (sb)/(sth), replace placeholders with real words. A trailing placeholder may be omitted only when grammatical.',
      '- Ukrainian translation: max 15 words, sentence case, natural and grammatical, single spaces, punctuation attached to tokens (internal commas allowed).',
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

  return { reasoning, output, tasks: output, cost };
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
      '- For each input item, write a planning row with (id, word, partOfSpeech).',
      '- Build targetUsed from word: remove only (sb)/(sth). Keep all other words in the same order.',
      '- Write one English draft translation that contains targetUsed exactly once as a contiguous span.',
      '- Write one Ukrainian draft sentence that naturally translates to that English draft.',
      '- Map drafts to output fields with the same id: sentence = Ukrainian draft, translation = English draft.',
      '- In reasoning/thought summary, show compact per-item logs: id, word, partOfSpeech, targetUsed, translation.',
      '</workflow>',
      '<requirements>',
      '- Id: task.id matches input word.id.',
      '- Ukrainian sentence: max 15 words, sentence case, natural, grammatical, and single sentence.',
      '- English translation: max 15 words, sentence case, natural, single sentence, and contains targetUsed exactly once (case-insensitive).',
      '- Target integrity: do not paraphrase or shorten the target phrase. Do not drop, reorder, or replace function words (articles, prepositions, conjunctions, particles, modals).',
      '- Minimal variant is allowed only for verb/auxiliary inflection needed for agreement within the target phrase.',
      '- If target includes (sb)/(sth), replace placeholders with real words. A trailing placeholder may be omitted only when grammatical.',
      '- English translation must include required articles/prepositions/auxiliaries as separate tokens, with correct a/an and verb forms.',
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

  return { reasoning, output, tasks: output, cost };
};

export const toSynonymAndAntonym = async (words: WordData[]) => {
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
        synonym: z.string(),
        antonym: z.string(),
      }),
    }),
    prompt: [
      '<role>Act as an expert English lexicographer (synonym/antonym)</role>',
      `<task>Create exactly ${words.length} synonym/antonym pairs, one per input word</task>`,
      '<requirements>',
      '- Id: task.id matches input word.id.',
      '- Synonym and antonym match the target part of speech; for function words, keep the same category.',
      '- Do not use the target word/phrase in either output.',
      '- Use real words/phrases only (no placeholders like "N/A").',
      '- If no exact match exists, use near-synonyms or functional opposites.',
      '- Use common, clear vocabulary; single words or short phrases are acceptable.',
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
