import {
  decreaseMaxWordsToUnlock,
  getMaxWordsToUnlock,
  getUserWordById,
  updateUserWord,
} from '@/repositories/user-word.repository';
import type { AuthParams } from '@/types/auth.types';
import { Status } from '@/types/user-words.types';
import { db } from 'astro:db';
import { generateObject } from 'ai';
import { createGoogleGenerativeAI } from '@ai-sdk/google';
import { z } from 'zod';
import { type UserWord } from '@/types/user-words.types';
import { GEMINI_API_KEY } from 'astro:env/server';
import { getLearningWords } from '@/repositories/user-word.repository';

const google = createGoogleGenerativeAI({
  apiKey: GEMINI_API_KEY,
});

const model = google('gemini-2.5-flash-lite');

const REVIEW_AFTER_VALUE = 3;
const MAX_ENCOUNTER_COUNT = 3;

export const moveUserWordToNextStep = async (data: AuthParams<{ userWordId: number }>) => {
  await db.transaction(async (tx) => {
    const userWord = await getUserWordById(data, tx);
    const encounterCount = userWord.encounterCount + 1;

    await decreaseMaxWordsToUnlock(data, tx);

    if (encounterCount >= MAX_ENCOUNTER_COUNT) {
      await updateUserWord({ ...data, wordsToUnlock: 0, encounterCount, status: Status.Learned }, tx);
    } else {
      const maxWordsToUnlock = await getMaxWordsToUnlock(data, tx);

      await updateUserWord({ ...data, wordsToUnlock: maxWordsToUnlock + REVIEW_AFTER_VALUE, encounterCount }, tx);
    }
  });
};

const schema = z.object({
  fillTheGap: z.array(
    z.object({
      id: z.number(),
      sentence: z.string(),
    }),
  ),
});

const toFillTheGapTasks = async ({ words, limit }: { limit: number; words: UserWord[] }) => {
  const wordList = words.map(({ id, word }) => ({
    id,
    value: word.value,
    partOfSpeech: word.partOfSpeech,
    level: word.level,
    definition: word.definition,
  }));

  const { object } = await generateObject({
    model,
    schema,
    prompt: [
      'You are a professional English tutor experienced in creating learner-friendly practice tasks.',
      'Create concise, context-rich fill-the-gap practice tasks tailored to the provided words.',
      '',
      'Requirements:',
      `- Sentences must be created for each provided word (exactly ${limit}).`,
      '- Sentences must sound natural and use modern, neutral tone.',
      '- Sentences must contain a single blank represented as "___" and the missing word must be exactly the target word (case-insensitive match).',
      '',
      'Words:',
      '```json',
      JSON.stringify(wordList),
      '```',
    ].join('\n'),
  });

  return object;
};

export const getLearningTasks = async (body: AuthParams<{ limit: number }>) => {
  const words = await getLearningWords(body);

  return await toFillTheGapTasks({ words, ...body });
};
