import { describe, expect, it } from 'vitest';
import { toTranslateEnglishSentence, toTranslateUkrainianSentence, type WordData } from '@/services/user-word.service';
import { randomInt } from 'node:crypto';
import '__tests__/expect/to-satisfy-statements.expect';

describe.concurrent('user-word.service', () => {
  const countWordsBySpaces = (value: string) => {
    const trimmedValue = value.trim();

    if (!trimmedValue) {
      return 0;
    }

    return (trimmedValue.match(/ /gim)?.length ?? 0) + 1;
  };

  const hasForbiddenSemicolonOrColon = (value: string) => /[;:]/gim.test(value);

  const word = (data: Omit<WordData, 'id'>) => ({
    id: randomInt(1, 10000),
    ...data,
  });

  const words = (
    [
      {
        value: 'a',
        partOfSpeech: 'indefinite article',
      },
      {
        value: 'can',
        partOfSpeech: 'modal verb',
      },
      {
        value: 'be going to do (sth)',
        partOfSpeech: null,
      },
      {
        value: 'for the first time',
        partOfSpeech: null,
      },
      {
        value: 'take (sb) out',
        partOfSpeech: null,
      },

      {
        value: 'ability',
        partOfSpeech: 'noun',
      },
      {
        value: 'challenge',
        partOfSpeech: 'noun',
      },
      {
        value: 'abandon',
        partOfSpeech: 'verb',
      },
      {
        value: 'absence',
        partOfSpeech: 'noun',
      },
    ] satisfies Omit<WordData, 'id'>[]
  ).map((data) => word(data));

  describe('toTranslateEnglishSentence', () => {
    it('generates English to Ukrainian translation tasks', async () => {
      const { reasoning, tasks } = await toTranslateEnglishSentence(words);
      console.log('to-translate-english-sentence', JSON.stringify({ reasoning, tasks }, null, 2));

      expect(tasks).toHaveLength(words.length);
      expect(tasks.map((task) => task.id).toSorted()).toEqual(words.map((word) => word.id).toSorted());
      for (const task of tasks) {
        expect(task).toHaveProperty('id');
        expect(task).toHaveProperty('sentence');
        expect(task).toHaveProperty('translation');
        expect(typeof task.sentence).toBe('string');
        expect(typeof task.translation).toBe('string');
        expect(task.sentence.length).toBeGreaterThan(0);
        expect(task.translation.length).toBeGreaterThan(0);
        expect(task.sentence[0]).toBe(task.sentence[0]?.toUpperCase());
        expect(task.translation[0]).toBe(task.translation[0]?.toUpperCase());
        expect(countWordsBySpaces(task.sentence)).toBeLessThanOrEqual(15);
        expect(countWordsBySpaces(task.translation)).toBeLessThanOrEqual(15);
        expect(hasForbiddenSemicolonOrColon(task.sentence)).toBe(false);
        expect(hasForbiddenSemicolonOrColon(task.translation)).toBe(false);
      }

      await expect({ words, tasks }).toSatisfyStatements([
        `Exactly ${words.length} tasks with id matching input word.id, an English sentence, and a Ukrainian translation.`,
        'English sentences are max 15 words, natural, capitalized, and contain the target phrase (case-insensitive) or a minimal grammatical variant limited to inflection/conjugation of verbs or auxiliaries within the target (e.g., "be going to" -> "is going to"); do not swap articles or other function words. For targets with placeholders, replace every (sb)/(sth) with real words and do not omit placeholders (including internal slots, e.g., "take (sb) out" -> "take her out").',
        'Ukrainian translations are max 15 words, natural, sentence case, single spaces, standard punctuation (internal commas allowed; final punctuation attached).',
        'Use a single sentence only; avoid semicolons or colons and do not join two independent clauses.',
        'Ukrainian translations have a single unambiguous word order when shuffled, with pronouns/prepositions/conjunctions/particles kept as separate tokens.',
        'Ukrainian adjective-noun agreement is correct for gender/number/case.',
      ]);
    });
  });

  describe('toTranslateUkrainianSentence', () => {
    it('generates Ukrainian to English translation tasks', async () => {
      const { reasoning, tasks } = await toTranslateUkrainianSentence(words);
      console.log('to-translate-ukrainian-sentence', JSON.stringify({ reasoning, tasks }, null, 2));

      expect(tasks).toHaveLength(words.length);
      expect(tasks.map((task) => task.id).toSorted()).toEqual(words.map((word) => word.id).toSorted());
      for (const task of tasks) {
        expect(task).toHaveProperty('id');
        expect(task).toHaveProperty('sentence');
        expect(task).toHaveProperty('translation');
        expect(typeof task.sentence).toBe('string');
        expect(typeof task.translation).toBe('string');
        expect(task.sentence.length).toBeGreaterThan(0);
        expect(task.translation.length).toBeGreaterThan(0);
        expect(task.sentence[0]).toBe(task.sentence[0]?.toUpperCase());
        expect(task.translation[0]).toBe(task.translation[0]?.toUpperCase());
        expect(countWordsBySpaces(task.sentence)).toBeLessThanOrEqual(15);
        expect(countWordsBySpaces(task.translation)).toBeLessThanOrEqual(15);
        expect(hasForbiddenSemicolonOrColon(task.sentence)).toBe(false);
        expect(hasForbiddenSemicolonOrColon(task.translation)).toBe(false);
      }

      await expect({ words, tasks }).toSatisfyStatements([
        `Exactly ${words.length} tasks with id matching input word.id, a Ukrainian sentence, and an English translation.`,
        'Ukrainian sentences are max 15 words, natural, and capitalized.',
        'English translations are max 15 words, natural, grammatical, sentence case, and contain the target phrase (case-insensitive) or a minimal grammatical variant limited to inflection/conjugation of verbs or auxiliaries within the target (e.g., "be going to" -> "is going to"); do not swap articles or other function words. For targets with placeholders, replace every (sb)/(sth) with real words and do not omit placeholders (including internal slots, e.g., "take (sb) out" -> "take her out").',
        'English translations use single spaces with punctuation attached to tokens (internal commas allowed; final punctuation attached to the last token).',
        'English translations include required articles, prepositions, and auxiliaries as separate tokens, with correct a/an usage and verb forms.',
        'Use a single sentence only; avoid semicolons or colons and do not join two independent clauses.',
        'English translations have a single unambiguous word order when shuffled, with articles/prepositions/conjunctions/auxiliaries as separate tokens.',
      ]);
    });
  });
});
