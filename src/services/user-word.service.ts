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

const model = google('gemini-2.5-flash');

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
      options: z.array(
        z.object({
          value: z.string(),
          isCorrect: z.boolean(),
        }),
      ),
    }),
  ),
});

const buildAiLearningTasks = async ({ words, limit }: { limit: number; words: UserWord[] }) => {
  const wordList = words.map(({ id, word }) => ({
    id,
    value: word.value,
    level: word.level,
    definition: word.definition,
  }));

  const { object } = await generateObject({
    model,
    schema,
    system: [
      'You are an experienced English tutor.',
      'Create concise, context-rich practice tasks tailored to the provided vocabulary.',
      'Sentences must sound natural and use modern, neutral tone.',
    ].join('\n'),
    prompt: [
      `Generate fill-the-gap sentences for each provided word (exactly ${limit}) using the vocabulary below.`,
      'Requirements:',
      '- Align the language, grammar, and context with the CEFR level of the referenced word.',
      '- Fill-the-gap sentences must contain a single blank represented as "___" and the missing word must be exactly the target word (case-insensitive match) with exactly 4 options.',
      '- Return valid JSON that matches the provided schema.',
      '',
      'Words dataset (JSON):',
      '```json',
      JSON.stringify(wordList, null, 2),
      '```',
    ].join('\n'),
  });

  return object;
};

export const getLearningTasks = async (body: AuthParams<{ limit: number }>) => {
  const words = await getLearningWords(body);

  return await buildAiLearningTasks({ words, ...body });
};
