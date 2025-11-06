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

const toFillInTheGapTasks = async (words: UserWord[]) => {
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
        task: z.string(),
        answer: z.string(),
      }),
    ),
    prompt: [
      'You are a professional English teacher who creates concise, natural fill-in-the-gap exercises for learners.',
      'For each provided English word or phrase, generate one English sentence where the target word or phrase is replaced by a blank.',
      '',
      'Requirements:',
      `- Generate exactly ${words.length} tasks, one for each input item, using the same ids.`,
      '- Each task must be a single, complete, natural English sentence (5–15 words).',
      '- The sentence must contain exactly one blank represented as "___".',
      '- The missing word or phrase must be exactly the target word/phrase (case-insensitive).',
      '- Do not include the target word/phrase anywhere else in the sentence.',
      '- For phrases, replace the entire phrase with the blank as one unit.',
      '- Use a natural, modern tone - avoid slang or overly formal expressions.',
      '- Make each sentence unique; avoid repeating structures or contexts.',
      '- Do not end sentences with a period.',
      '- The "answer" field must contain the exact form of the missing word or phrase that correctly fits the blank.',
      '- If the target phrase has placeholders (e.g., "agree with (sb)", "take care of (sth)"), adapt the sentence naturally (e.g., target "agree with (sb)" → sentence "I ___ you" → answer "agree with").',
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
            isAnswer: z.boolean(),
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
      '- Each task must include 4 Ukrainian options: 1 correct translation (isAnswer: true) and 3 incorrect but plausible ones (isAnswer: false).',
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
            isAnswer: z.boolean(),
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
      '- Each task must include 4 full-sentence English options: 1 correct (isAnswer: true) and 3 incorrect (isAnswer: false).',
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

const toSynonymAndAntonymTasks = async (words: UserWord[]) => {
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
        synonym: z.string(),
        antonym: z.string(),
      }),
    ),
    prompt: [
      'You are a professional English teacher who creates vocabulary-building exercises for learners.',
      'For each provided English word or phrase, generate one synonym and one antonym based on its most common meaning.',
      '',
      'Requirements:',
      `- Generate exactly ${words.length} entries, one for each input item, using the same ids.`,
      '- Provide one synonym (similar meaning) and one antonym (opposite meaning) for each target word or phrase.',
      '- Use clear, common, and learner-friendly vocabulary.',
      '- Prefer single-word answers; use short phrases only when necessary.',
      '- The synonym and antonym must match the part of speech and approximate difficulty of the target word.',
      '- If a word has multiple meanings, use the primary one indicated by the provided definition.',
      '- Do not repeat the target word itself as a synonym or antonym.',
      '- Keep all outputs natural, lowercase (unless proper nouns), and free of quotes or punctuation.',
      '- Avoid rare, archaic, or overly technical words.',
      '',
      'Words and Phrases:',
      '```json',
      JSON.stringify(wordList),
      '```',
    ].join('\n'),
  });

  return object;
};

const toFindIncorrectSentenceTasks = async (words: UserWord[]) => {
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
        options: z.array(
          z.object({
            value: z.string(),
            isAnswer: z.boolean(),
            description: z.string().optional(),
          }),
        ),
      }),
    ),
    prompt: [
      'You are a professional English teacher who creates mistake detection exercises for learners.',
      'For each provided English word or phrase, generate four sentences where three use the word correctly and one uses it incorrectly.',
      '',
      'Requirements:',
      `- Generate exactly ${words.length} tasks, one per input item, using the same ids.`,
      '- Each task must include 4 sentence options, all using or referencing the target word or phrase.',
      '- Exactly three sentences must use the word/phrase CORRECTLY (isAnswer: false) - they must accurately demonstrate proper usage, meaning, or context of the word/phrase.',
      '- Exactly one sentence must use the word/phrase INCORRECTLY (isAnswer: true) - this is the answer the user should select. It must be clearly wrong but plausible (wrong preposition, incorrect collocation, wrong grammatical form, wrong context, or misuse of meaning).',
      '- The sentence with isAnswer: true MUST be grammatically incorrect or use the word/phrase incorrectly. Do NOT mark correct sentences as isAnswer: true.',
      '- Do NOT mark sentences as incorrect just because they are "less natural" or "less idiomatic". A sentence is only incorrect if it is grammatically wrong or uses the word/phrase in a way that breaks clear rules of English usage.',
      '- The incorrect usage must be OBVIOUS and CLEAR - use blatant mistakes that learners can easily identify. If a sentence is grammatically correct but just sounds less natural, it should be marked as correct (isAnswer: false).',
      '- All sentences must be complete, natural English sentences (3–15 words).',
      '- The description field must only be provided for the incorrect sentence (isAnswer: true) and should be a short explanation of why it is incorrect.',
      '- The target word or phrase must appear in each sentence.',
      '- Do not include periods at the end of sentences.',
      '- Avoid repeating topics or patterns across tasks.',
      '',
      'Words and Phrases:',
      '```json',
      JSON.stringify(wordList),
      '```',
    ].join('\n'),
  });

  return object;
};

const toWordOrderTasks = async (words: UserWord[]) => {
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
      }),
    ),
    prompt: [
      'You are a professional English teacher who creates word order exercises for learners.',
      'For each provided English word or phrase, generate a sentence that needs to be arranged in the correct order.',
      '',
      'Requirements:',
      `- Generate exactly ${words.length} tasks, one per input item, using the same ids.`,
      '- Each task must include the target word or phrase as part of a complete, natural English sentence.',
      '- The sentence must be a single string with words separated by spaces.',
      '- The sentence must contain all words in the CORRECT order (this is the answer).',
      '- Include articles (a, an, the), prepositions, and other function words as separate words.',
      '- Each word should be separated by a single space.',
      '- The sentence must be natural, modern English (5-15 words total).',
      '- The target word or phrase must appear in the sentence.',
      '- Do not include punctuation marks in the sentence.',
      '- Capitalize first word that starts the sentence.',
      '- Make sentences unique; avoid repeating structures or contexts.',
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
    fillInTheGapTasks,
    translateEnglishSentenceTasks,
    translateUkrainianSentenceTasks,
    synonymAndAntonymTasks,
    findIncorrectSentenceTasks,
    wordOrderTasks,
  ] = await Promise.all([
    toFillInTheGapTasks(words),
    toTranslateEnglishSentenceTasks(words),
    toTranslateUkrainianSentenceTasks(words),
    toSynonymAndAntonymTasks(words),
    toFindIncorrectSentenceTasks(words),
    toWordOrderTasks(words),
  ]);

  return {
    fillInTheGapTasks,
    translateEnglishSentenceTasks,
    translateUkrainianSentenceTasks,
    synonymAndAntonymTasks,
    findIncorrectSentenceTasks,
    wordOrderTasks,
  };
};
