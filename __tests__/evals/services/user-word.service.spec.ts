import { describe, expect, it } from 'vitest';
import { toTranslateEnglishSentence, toTranslateUkrainianSentence, type WordData } from '@/services/user-word.service';
import { randomInt } from 'node:crypto';
import '__tests__/expect/to-satisfy-statements.expect';

describe.concurrent('user-word.service', () => {
  const word = (data: Omit<WordData, 'id'>) => ({
    id: randomInt(1, 10000),
    ...data,
  });

  const words = (
    [
      {
        value: 'a',
        definition:
          'used before countable or singular nouns referring to people or things that have not already been mentioned',
        partOfSpeech: 'indefinite article',
        level: 'a1',
      },
      {
        value: 'can',
        definition:
          'used to say that it is possible for somebody/something to do something, or for something to happen',
        partOfSpeech: 'modal verb',
        level: 'a1',
      },
      {
        value: 'be going to do (sth)',
        definition: 'to move or travel from one place to another',
        partOfSpeech: null,
        level: 'a1',
      },
      {
        value: 'for the first time',
        definition: 'happening or coming before all other similar things or people; 1st',
        partOfSpeech: null,
        level: 'a1',
      },

      {
        value: 'ability',
        definition: 'the fact that somebody/something is able to do something',
        partOfSpeech: 'noun',
        level: 'a2',
      },
      {
        value: 'challenge',
        definition: "a new or difficult task that tests somebody's ability and skill",
        partOfSpeech: 'noun',
        level: 'b1',
      },
      {
        value: 'abandon',
        definition: 'to leave somebody, especially somebody you are responsible for, with no intention of returning',
        partOfSpeech: 'verb',
        level: 'b2',
      },
      {
        value: 'absence',
        definition:
          'the fact of somebody being away from a place where they are usually expected to be; the occasion or period of time when somebody is away',
        partOfSpeech: 'noun',
        level: 'c1',
      },
    ] satisfies Omit<WordData, 'id'>[]
  ).map((data) => word(data));

  describe('toTranslateEnglishSentence', () => {
    it('generates English to Ukrainian translation tasks', async () => {
      const { output, tasks } = await toTranslateEnglishSentence(words);
      console.log('to-translate-english-sentence', JSON.stringify(output, null, 2));

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
      }

      await expect({ words, tasks }).toSatisfyStatements([
        `Exactly ${words.length} tasks with id matching input word.id, English sentence (3-15 words with target word), and Ukrainian translation.`,
        'English sentences are 3-15 words, natural modern English, first word capitalized, punctuation attached to words.',
        'Target word/phrase or natural variation appears in the English sentence.',
        'Ukrainian translations are 3-15 words, grammatically correct natural Ukrainian, single-space separated, first word capitalized, punctuation attached to words.',
        'Ukrainian translation word order is unambiguous when shuffled — no two valid orderings exist.',
        'ALL Ukrainian words are separate tokens: pronouns, prepositions, conjunctions, particles are individual words.',
        'Tasks cover various CEFR levels (A1-C1), which is expected.',
      ]);
    });
  });

  describe('toTranslateUkrainianSentence', () => {
    it('generates Ukrainian to English translation tasks', async () => {
      const { output, tasks } = await toTranslateUkrainianSentence(words);
      console.log('to-translate-ukrainian-sentence', JSON.stringify(output, null, 2));

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
      }

      await expect({ words, tasks }).toSatisfyStatements([
        `Exactly ${words.length} tasks with id matching input word.id, Ukrainian sentence (3-15 words), and English translation.`,
        'Ukrainian sentences are 3-15 words, natural modern Ukrainian, first word capitalized.',
        'English translations are 3-15 words, grammatically perfect, include ALL articles, ALL prepositions, ALL auxiliary verbs, correct verb forms.',
        'English translation word order is unambiguous when shuffled — no two valid orderings exist.',
        'ALL English words are separate tokens: articles, prepositions, conjunctions, auxiliaries are individual words.',
        'Tasks cover various CEFR levels (A1-C1), which is expected.',
        'Minor Ukrainian phrasing variations are acceptable as long as the meaning is clear.',
      ]);
    });
  });
});
