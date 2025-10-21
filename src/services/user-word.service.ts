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

const google = createGoogleGenerativeAI({
  apiKey: GEMINI_API_KEY,
});

const model = google('gemini-2.5-flash-lite');

const toFillTheGapTasks = async ({ words, limit }: { limit: number; words: UserWord[] }) => {
  const wordList = words.map(({ id, word }) => ({
    id,
    value: word.value,
    partOfSpeech: word.partOfSpeech,
    level: word.level,
  }));

  const { object } = await generateObject({
    model,
    schema: z.array(
      z.object({
        id: z.number(),
        task: z.string(),
      }),
    ),
    prompt: [
      'You are a professional English tutor experienced in designing engaging, context-rich fill-the-gap exercises for learners.',
      'Your task is to create one short, natural English sentence for each provided word, where the target word is replaced with a blank.',
      '',
      'Requirements:',
      `- Generate exactly ${limit} tasks - one for each provided word.`,
      '- Each task must be a single, complete, natural English sentence (5–15 words).',
      '- Each sentence must contain exactly one blank, represented by "___".',
      '- The missing word must be exactly the target word (case-insensitive match).',
      '- Do not include the target word anywhere else in the sentence.',
      '- Use a modern, neutral tone - avoid slang, idioms, or overly complex structures.',
      '- Avoid repeating sentence structures or topics across tasks; make each example unique.',
      '- Do not use periods at the end of the sentence.',
      '',
      'Words:',
      '```json',
      JSON.stringify(wordList),
      '```',
    ].join('\n'),
  });

  return object;
};

const toTranslateSentenceTasks = async ({ words, limit }: { limit: number; words: UserWord[] }) => {
  const wordList = words.map(({ id, word }) => ({
    id,
    value: word.value,
    partOfSpeech: word.partOfSpeech,
    level: word.level,
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
      'Your task is to create one concise Ukrainian sentence (1–12 words) and 4 English translation options for each provided word.',
      '',
      'Requirements:',
      `- Generate exactly ${limit} sentences - one for each provided word.`,
      '- The Ukrainian sentence must include or clearly express the meaning of the target English word.',
      '- Sentences must be short (1–12 words), natural, and use a modern, neutral tone.',
      '- Do not use periods at the end of the sentence.',
      '- Each task must include 4 English options:',
      '   - 1 correct translation (isCorrect: true).',
      '   - 3 plausible but incorrect options (isCorrect: false).',
      '- All English options must sound grammatically correct and natural.',
      '- Distractors should be close in structure or meaning but not identical.',
      '- The correct option must precisely reflect the meaning of the Ukrainian sentence.',
      '- Avoid using the same topics or repetitive sentence structures across examples.',
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
  const [fillTheGapTasks, translateSentenceTasks] = await Promise.all([
    toFillTheGapTasks({ words, ...body }),
    toTranslateSentenceTasks({ words, ...body }),
  ]);

  return { fillTheGapTasks, translateSentenceTasks };
};
