import {
  decreaseMaxWordsToUnlock,
  getMaxWordsToUnlock,
  getUserWordById,
  updateUserWord,
  updateUserWordStatus,
} from '@/repositories/user-word.repository';
import type { AuthParams } from '@/types/auth.types';
import { Status, type DiscoveryStatus } from '@/types/user-words.types';
import { EventType } from '@/types/event.types';
import { db } from 'astro:db';
import { generateObject } from 'ai';
import { createGoogleGenerativeAI } from '@ai-sdk/google';
import { z } from 'zod';
import { type UserWord } from '@/types/user-words.types';
import { GEMINI_API_KEY } from 'astro:env/server';
import { getLearningWords } from '@/repositories/user-word.repository';
import { deleteDiscoveryWordStatusChangedEvents, insertEvent } from '@/repositories/event.repository';

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

export const setDiscoveryStatus = async (data: AuthParams<{ userWordId: number; status: DiscoveryStatus }>) => {
  await db.transaction(async (tx) => {
    if (data.status === Status.Waiting) {
      await deleteDiscoveryWordStatusChangedEvents(data, tx);
    } else {
      await insertEvent(
        {
          type: EventType.DiscoveryWordStatusChanged,
          userId: data.userId,
          userWordId: data.userWordId,
          data: { status: data.status },
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

const toFillTheGapTasks = async ({ words, limit }: { limit: number; words: UserWord[] }) => {
  if (!words.length) {
    return [];
  }

  const wordList = words.map(({ id, word }) => ({
    id,
    value: word.value,
    partOfSpeech: word.partOfSpeech,
    level: word.level,
    definition: word.definition,
  }));

  const { object } = await generateObject({
    model,
    schema: z.array(
      z.object({
        id: z.number(),
        task: z.string(),
        answer: z.string(),
      }),
    ),
    prompt: [
      'You are a professional English tutor experienced in designing engaging, context-rich fill-the-gap exercises for learners.',
      'Your task is to create one short, natural English sentence for each provided word or phrase, where the target word/phrase is replaced with a blank.',
      '',
      'Requirements:',
      `- Generate exactly ${limit} tasks - one for each provided word or phrase.`,
      '- Each task must be a single, complete, natural English sentence (5–15 words).',
      '- Each sentence must contain exactly one blank, represented by "___".',
      '- The missing word/phrase must be exactly the target word/phrase (case-insensitive match).',
      '- Do not include the target word/phrase anywhere else in the sentence.',
      '- For phrases, the blank should replace the entire phrase as a unit.',
      '- Use a modern, neutral tone - avoid slang or overly complex structures.',
      '- Avoid repeating sentence structures or topics across tasks; make each example unique.',
      '- Do not use periods at the end of the sentence.',
      '- The "answer" field must contain the exact form of the word/phrase that fits the blank in the sentence.',
      '- If the target is a phrase with placeholders like "agree with sb", "take care of (sth)", the answer should match the sentence context (e.g., "agree with (sb)" → sentence "I ___ you" → answer "agree with").',
      '',
      'Words and Phrases:',
      '```json',
      JSON.stringify(wordList),
      '```',
    ].join('\n'),
  });

  return object;
};

const toTranslateEnglishSentenceTasks = async ({ words, limit }: { limit: number; words: UserWord[] }) => {
  if (!words.length) {
    return [];
  }

  const wordList = words.map(({ id, word }) => ({
    id,
    value: word.value,
    partOfSpeech: word.partOfSpeech,
    level: word.level,
    definition: word.definition,
  }));

  const { object } = await generateObject({
    model,
    schema: z.array(
      z.object({
        id: z.number(),
        sentence: z.string(),
        options: z.array(
          z.object({
            value: z.string(),
            isCorrect: z.boolean(),
          }),
        ),
      }),
    ),
    prompt: [
      'You are a professional English teacher experienced in creating short natural English sentences for learners.',
      'Your task is to create one concise English sentence (1–12 words) and 4 Ukrainian translation options for each provided word or phrase.',
      '',
      'Requirements:',
      `- Generate exactly ${limit} sentences - one for each provided word or phrase.`,
      '- The English sentence must include or clearly express the meaning of the target English word or phrase.',
      '- For phrases, use the complete phrase naturally within the sentence.',
      '- Sentences must be short (1–12 words), natural, and use a modern, neutral tone.',
      '- Do not use periods at the end of the sentence.',
      '- Each task must include 4 options: 1 correct Ukrainian translation (isCorrect: true) and 3 plausible but incorrect Ukrainian translations (isCorrect: false).',
      '- Incorrect options should be close in structure or meaning but not identical.',
      '- All Ukrainian options must look natural and grammatically correct in Ukrainian.',
      '- Avoid using the same topics or repetitive sentence structures across examples.',
      '',
      'Words and Phrases:',
      '```json',
      JSON.stringify(wordList),
      '```',
    ].join('\n'),
  });

  return object;
};

const toTranslateUkrainianSentenceTasks = async ({ words, limit }: { limit: number; words: UserWord[] }) => {
  if (!words.length) {
    return [];
  }

  const wordList = words.map(({ id, word }) => ({
    id,
    value: word.value,
    partOfSpeech: word.partOfSpeech,
    level: word.level,
    definition: word.definition,
  }));

  const { object } = await generateObject({
    model,
    schema: z.array(
      z.object({
        id: z.number(),
        sentence: z.string(),
        options: z.array(
          z.object({
            value: z.string(),
            isCorrect: z.boolean(),
          }),
        ),
      }),
    ),
    prompt: [
      'You are a professional English teacher experienced in creating short natural Ukrainian sentences for learners.',
      'Your task is to create one concise Ukrainian sentence (1–12 words) and 4 English translation options for each provided word or phrase.',
      '',
      'Requirements:',
      `- Generate exactly ${limit} sentences - one for each provided word or phrase.`,
      '- The Ukrainian sentence must include or clearly express the meaning of the target English word or phrase.',
      '- Sentences must be short (1–12 words), natural, and use a modern, neutral tone.',
      '- Do not use periods at the end of the sentence.',
      '- Each task must include 4 options: 1 correct translation (isCorrect: true) and 3 plausible but incorrect translations (isCorrect: false).',
      '- The correct option must include the target word or phrase in English, exactly as given in the input list.',
      '- For phrases, the correct option must include the complete phrase as a unit.',
      '- Incorrect options should be close in structure or meaning but not identical.',
      '- All English options must sound grammatically correct and natural.',
      '- The correct option must precisely reflect the meaning of the Ukrainian sentence.',
      '- Avoid using the same topics or repetitive sentence structures across examples.',
      '',
      'Words and Phrases:',
      '```json',
      JSON.stringify(wordList),
      '```',
    ].join('\n'),
  });

  return object;
};

const toSynonymTasks = async ({ words, limit }: { limit: number; words: UserWord[] }) => {
  if (!words.length) {
    return [];
  }

  const wordList = words.map(({ id, word }) => ({
    id,
    value: word.value,
    partOfSpeech: word.partOfSpeech,
    level: word.level,
    definition: word.definition,
  }));

  const { object } = await generateObject({
    model,
    schema: z.array(
      z.object({
        id: z.number(),
        synonym: z.string(),
      }),
    ),
    prompt: [
      'You are a professional English teacher experienced in creating vocabulary exercises for learners.',
      'Your task is to provide one synonym for each provided word or phrase that learners should recognize.',
      '',
      'Requirements:',
      `- Generate exactly ${limit} synonyms - one for each provided word or phrase.`,
      '- Each synonym should be a single word or short phrase that has a similar meaning to the target word/phrase.',
      '- Choose synonyms that are:',
      '  - Common and natural in modern English',
      '  - Appropriate for the provided level of each word',
      '  - Close in meaning but not identical',
      '  - Easy to understand for language learners',
      '- For phrases, provide a synonymous phrase or expression.',
      '- Avoid using archaic, overly formal, or slang terms unless the target word is also of that register.',
      '- If a word has no clear synonym, provide the most logically related or similar concept.',
      '- Each synonym should be distinct and not repeat across different words.',
      '',
      'Words and Phrases:',
      '```json',
      JSON.stringify(wordList),
      '```',
    ].join('\n'),
  });

  return object;
};

const toAntonymTasks = async ({ words, limit }: { limit: number; words: UserWord[] }) => {
  if (!words.length) {
    return [];
  }

  const wordList = words.map(({ id, word }) => ({
    id,
    value: word.value,
    partOfSpeech: word.partOfSpeech,
    level: word.level,
    definition: word.definition,
  }));

  const { object } = await generateObject({
    model,
    schema: z.array(
      z.object({
        id: z.number(),
        antonym: z.string(),
      }),
    ),
    prompt: [
      'You are a professional English teacher experienced in creating vocabulary exercises for learners.',
      'Your task is to provide one antonym for each provided word or phrase that learners should recognize.',
      '',
      'Requirements:',
      `- Generate exactly ${limit} antonyms - one for each provided word or phrase.`,
      '- Each antonym should be a single word or short phrase that has an opposite meaning to the target word/phrase.',
      '- Choose antonyms that are:',
      '  - Common and natural in modern English',
      '  - Appropriate for the provided level of each word',
      '  - Clear opposites (not just different)',
      '  - Easy to understand for language learners',
      '- For phrases, provide an antonymous phrase or expression.',
      '- Avoid using archaic, overly formal, or slang terms unless the target word is also of that register.',
      '- If a word has no clear antonym, provide the most logical opposite concept.',
      '- Each antonym should be distinct and not repeat across different words.',
      '',
      'Words and Phrases:',
      '```json',
      JSON.stringify(wordList),
      '```',
    ].join('\n'),
  });

  return object;
};

export const getLearningTasks = async (body: AuthParams<{ limit: number }>) => {
  const words = await getLearningWords(body);
  const [fillTheGapTasks, translateEnglishSentenceTasks, translateUkrainianSentenceTasks, synonymTasks, antonymTasks] =
    await Promise.all([
      toFillTheGapTasks({ words, ...body }),
      toTranslateEnglishSentenceTasks({ words, ...body }),
      toTranslateUkrainianSentenceTasks({ words, ...body }),
      toSynonymTasks({ words, ...body }),
      toAntonymTasks({ words, ...body }),
    ]);

  return {
    fillTheGapTasks,
    translateEnglishSentenceTasks,
    translateUkrainianSentenceTasks,
    synonymTasks,
    antonymTasks,
  };
};
