import { describe, expect, it } from 'vitest';
import {
  toTranslateEnglishSentence,
  toTranslateUkrainianSentence,
  type VocabularyItemData,
} from '@/server/vocabulary-task/vocabulary-task.service';
import { randomInt } from 'node:crypto';

describe.concurrent('vocabulary-task.service', () => {
  const countWordsBySpaces = (value: string) => {
    const trimmedValue = value.trim();

    if (!trimmedValue) {
      return 0;
    }

    return (trimmedValue.match(/ /gim)?.length ?? 0) + 1;
  };

  const hasForbiddenSemicolonOrColon = (value: string) => /[;:]/gim.test(value);
  const hasForbiddenDash = (value: string) => /[-–—]/gim.test(value);

  const item = (data: Omit<VocabularyItemData, 'id'>) => ({
    id: randomInt(1, 10000),
    ...data,
  });

  const items = (
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
    ] satisfies Omit<VocabularyItemData, 'id'>[]
  ).map((data) => item(data));

  describe('toTranslateEnglishSentence', () => {
    it('generates English to Ukrainian translation tasks', async () => {
      const { reasoning, tasks } = await toTranslateEnglishSentence(items);
      console.log('to-translate-english-sentence', JSON.stringify({ reasoning, tasks }, null, 2));

      expect(tasks).toHaveLength(items.length);
      expect(tasks.map((task) => task.id).toSorted()).toEqual(items.map((item) => item.id).toSorted());
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
        expect(hasForbiddenDash(task.sentence)).toBe(false);
        expect(hasForbiddenDash(task.translation)).toBe(false);
      }

      await expect({ items, tasks }).toSatisfyStatements([
        `Exactly ${items.length} tasks with id matching input item.id, an English sentence, and a Ukrainian translation.`,
        'English sentences are max 15 words, natural, sentence case, and contain the target phrase (case-insensitive) or a minimal verb/auxiliary inflection (e.g., "be going to" -> "is going to"). All function words unchanged. Parenthesized placeholders replaced with concrete words, never output literally.',
        'Ukrainian translations are max 15 words, sentence case, single spaces, punctuation attached to tokens. No dashes (–, —). Must sound natural and idiomatic to a native Ukrainian speaker, not word-for-word from English.',
        'Single sentence only. No semicolons, colons, or dashes. No joined independent clauses.',
        'Ukrainian translations have one unambiguous word order when shuffled, with pronouns/prepositions/conjunctions/particles as separate tokens.',
        'Ukrainian grammar should be generally correct. Do NOT flag declension variations as errors. Both singular and plural accusative/genitive forms are valid (e.g., "бабусю і дідуся", "бабусів і дідусів", "бабусь і дідусів" are all acceptable).',
        'Sentences use specific real-world context, not vague or abstract phrases.',
      ]);
    });
  });

  describe('toTranslateUkrainianSentence', () => {
    it('generates Ukrainian to English translation tasks', async () => {
      const { reasoning, tasks } = await toTranslateUkrainianSentence(items);
      console.log('to-translate-ukrainian-sentence', JSON.stringify({ reasoning, tasks }, null, 2));

      expect(tasks).toHaveLength(items.length);
      expect(tasks.map((task) => task.id).toSorted()).toEqual(items.map((item) => item.id).toSorted());
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
        expect(hasForbiddenDash(task.sentence)).toBe(false);
        expect(hasForbiddenDash(task.translation)).toBe(false);
      }

      await expect({ items, tasks }).toSatisfyStatements([
        `Exactly ${items.length} tasks with id matching input item.id, a Ukrainian sentence, and an English translation.`,
        'Ukrainian sentences are max 15 words, sentence case. No dashes (–, —). Must sound natural and idiomatic to a native Ukrainian speaker, not word-for-word from English. Do NOT flag grammar style preferences as errors. Accept all valid Ukrainian constructions: alternative declension forms (e.g., "бабусю і дідуся" and "бабусів і дідусів" are both valid), active impersonal voice (e.g., "покинули") alongside passive (e.g., "було покинуто"), and flexible word order.',
        'English translations are max 15 words, sentence case, and contain the target phrase (case-insensitive) or a minimal verb/auxiliary inflection (e.g., "be going to" -> "is going to"). All function words unchanged. Parenthesized placeholders replaced with concrete words, never output literally.',
        'English translations use single spaces, punctuation attached to tokens. Include required articles/prepositions/auxiliaries as separate tokens.',
        'Single sentence only. No semicolons, colons, or dashes. No joined independent clauses.',
        'English translations have one unambiguous word order when shuffled.',
        'Sentences use specific real-world context, not vague or abstract phrases.',
      ]);
    });
  });
});
