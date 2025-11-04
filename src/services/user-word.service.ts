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
import { deleteWordDiscoveredEvents, insertEvent } from '@/repositories/event.repository';

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

const toFillTheGapTasks = async (words: UserWord[]) => {
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
      `- Generate exactly ${words.length} tasks - one for each provided word or phrase.`,
      '- Each task must be a single, complete, natural English sentence (5–15 words).',
      '- Each sentence must contain exactly one blank, represented by "___".',
      '- The missing word/phrase must be exactly the target word/phrase (case-insensitive match).',
      '- Do not include the target word/phrase anywhere else in the sentence.',
      '- For phrases, the blank should replace the entire phrase as a unit.',
      '- Use a modern, neutral tone - avoid slang or overly complex structures.',
      '- Avoid repeating sentence structures or topics across tasks; make each example unique.',
      '- Do not use periods at the end of the sentence.',
      '- The "answer" field must contain the exact form of the word/phrase that fits the blank in the sentence.',
      '- Use ids from the input list as ids for the tasks.',
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

const toTranslateEnglishSentenceTasks = async (words: UserWord[]) => {
  if (!words.length) return [];

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
      'You are a professional English teacher who creates short, natural English sentences for learners.',
      'For each given English word or phrase, generate one English sentence (1–12 words) and four Ukrainian translation options.',
      '',
      'Requirements:',
      `- Generate exactly ${words.length} tasks, one per input item, keeping the same ids.`,
      '- The English sentence must include or clearly express the meaning of the target English word or phrase.',
      '- If the input is a phrase, use the full phrase naturally within the sentence.',
      '- Sentences must be concise (1–12 words), modern, natural, and without periods.',
      '- Each task must include 4 Ukrainian options: 1 correct translation (isCorrect: true) and 3 incorrect but plausible ones (isCorrect: false).',
      '- The correct translation must precisely reflect the meaning of the English sentence.',
      '- Incorrect translations must be grammatically correct and natural but differ slightly in meaning (e.g., wrong preposition, verb, or adjective).',
      '- All Ukrainian sentences must sound fluent and natural for native speakers.',
      '- Avoid repeating topics, subjects, or sentence patterns across tasks.',
      '',
      'Words and Phrases:',
      '```json',
      JSON.stringify(wordList),
      '```',
    ].join('\n'),
  });

  return object;
};

const toTranslateUkrainianSentenceTasks = async (words: UserWord[]) => {
  if (!words.length) return [];

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
      'You are a professional English teacher who creates short, natural Ukrainian sentences for learners.',
      'For each given English word or phrase, create one Ukrainian sentence (1–12 words) and four English translation options.',
      '',
      'Requirements:',
      `- Generate exactly ${words.length} tasks, one per input item, reusing input ids.`,
      '- The Ukrainian sentence must include or clearly express the meaning of the target English word or phrase.',
      '- Sentences must be short (1–12 words), natural, modern, and without periods.',
      '- Each task must include 4 full-sentence English options: 1 correct (isCorrect: true) and 3 incorrect (isCorrect: false).',
      '- All options must be complete, natural English sentences, not single words or fragments.',
      '- The correct option must include the exact English word or phrase from the input (match exactly, case-sensitive).',
      '- The correct option must accurately reflect the meaning of the Ukrainian sentence.',
      '- Incorrect options must be natural but differ slightly in meaning (e.g., wrong preposition, similar verb, or altered adjective).',
      '- Use partOfSpeech and definition fields to make distractors realistic.',
      '- Vary topics and sentence patterns; avoid repetition.',
      '',
      'Words and Phrases:',
      '```json',
      JSON.stringify(wordList),
      '```',
    ].join('\n'),
  });

  return object;
};

const toSynonymAntonymTasks = async (words: UserWord[]) => {
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
        antonym: z.string(),
      }),
    ),
    prompt: [
      'You are a professional English teacher experienced in vocabulary exercises for learners.',
      'Your task is to provide one synonym and one antonym for each provided word or phrase.',
      '',
      'Requirements:',
      `- Generate exactly ${words.length} pairs - one for each provided word or phrase.`,
      '- For each word or phrase, provide one synonym (a word with similar meaning) and one antonym (a word with opposite meaning).',
      '- The synonym and antonym must be appropriate for the target word/phrase in its most common meaning.',
      '- Use common, well-known synonyms and antonyms that learners would recognize.',
      '- The synonym and antonym should be single words when possible, or short phrases if necessary.',
      '- Ensure the synonym and antonym are at a similar difficulty level to the target word.',
      '- If a word has multiple meanings, use the primary meaning indicated by the definition.',
      '- Do not use the target word itself in the synonym or antonym.',
      '- Use ids from the input list as ids for the tasks.',
      '',
      'Words and Phrases:',
      '```json',
      JSON.stringify(wordList),
      '```',
    ].join('\n'),
  });

  return object;
};

const toContinueDialogTasks = async (words: UserWord[]) => {
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
      'You are a professional English teacher experienced in creating dialog continuation exercises for learners.',
      'Your task is to create one complete English sentence (3–15 words) and 4 similar response options for each provided word or phrase.',
      '',
      'Requirements:',
      `- Generate exactly ${words.length} tasks - one for each provided word or phrase.`,
      '- The sentence must be a standalone question, statement, or conversational opener that naturally leads to a response using the target word or phrase.',
      '- The sentence must create a specific context where only ONE grammatical form is correct.',
      '- Each task must include 4 similar response options: 1 grammatically correct (isCorrect: true) that uses the target word/phrase correctly and continues the dialog naturally, and 3 with grammar mistakes (isCorrect: false).',
      '- All 4 options must be similar in meaning and attempt to continue the dialog, and all must use or reference the target word or phrase.',
      '- Grammar mistakes in incorrect options must be clearly wrong: wrong word choice, incorrect verb tense/form, wrong preposition that breaks grammar/collocation, incorrect word order, missing/incorrect articles, wrong plural/singular forms, or incorrect collocations.',
      '- Do not use synonyms and antonyms as mistakes.',
      '- Mistakes should be realistic errors that learners might make, but they must be unambiguously incorrect in the given context.',
      '- All options must be complete sentences, not fragments.',
      '- Sentences must be natural and use a modern, neutral tone.',
      '- Do not use periods at the end of the sentence or options.',
      '- Use ids from the input list as ids for the tasks.',
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

const toFixSentenceTasks = async (words: UserWord[]) => {
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
      'You are a professional English teacher experienced in creating grammar correction exercises for learners.',
      'Your task is to create one sentence with exactly 3 obvious grammar mistakes and 4 full-sentence correction options for each provided word or phrase.',
      '',
      'Requirements:',
      `- Generate exactly ${words.length} tasks - one for each provided word or phrase.`,
      '- Each `sentence` and its correction options must naturally include the provided word or phrase.',
      '- The provided word or phrase must appear in the `sentence` exactly as given or in its correct grammatical form within at least one of the options.',
      '- The `sentence` field must contain exactly 3 clear grammar mistakes (e.g., wrong tense, plural/singular mismatch, missing article, wrong adverb/adjective form, etc.).',
      '- The `options` field must contain 4 full-sentence correction options.',
      '- Exactly one option must be fully correct (isCorrect: true).',
      '- The other three must contain small grammatical or lexical mistakes (isCorrect: false).',
      '- Options must not be identical to the original incorrect sentence.',
      '- Do not include periods at the end of the sentence or options.',
      '- Use ids from the input list as ids for the tasks.',
      '- Avoid repetitive topics or sentence structures.',
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

  const [
    fillTheGapTasks,
    translateEnglishSentenceTasks,
    translateUkrainianSentenceTasks,
    synonymAntonymTasks,
    continueDialogTasks,
    fixSentenceTasks,
  ] = await Promise.all([
    toFillTheGapTasks(words),
    toTranslateEnglishSentenceTasks(words),
    toTranslateUkrainianSentenceTasks(words),
    toSynonymAntonymTasks(words),
    toContinueDialogTasks(words),
    toFixSentenceTasks(words),
  ]);

  return {
    fillTheGapTasks,
    translateEnglishSentenceTasks,
    translateUkrainianSentenceTasks,
    synonymAntonymTasks,
    continueDialogTasks,
    fixSentenceTasks,
  };
};
