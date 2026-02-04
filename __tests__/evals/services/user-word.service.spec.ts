import { describe, expect, it } from 'vitest';
import {
  toFillInTheGap,
  toTranslateEnglishSentence,
  toTranslateUkrainianSentence,
  toSynonymAndAntonym,
  type WordData,
} from '@/services/user-word.service';
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

  describe('toFillInTheGap', () => {
    it('generates fill-in-the-gap tasks', async () => {
      const { reasoning, tasks } = await toFillInTheGap(words);
      console.log('fill-in-the-gap', JSON.stringify({ reasoning, tasks }, null, 2));

      expect(tasks).toHaveLength(words.length);
      expect(tasks.map((task) => task.id).toSorted()).toEqual(words.map((word) => word.id).toSorted());
      for (const task of tasks) {
        expect(task).toHaveProperty('id');
        expect(task).toHaveProperty('task');
        expect(task).toHaveProperty('answer');
        expect(task.task).toContain('___');
      }

      await expect({ words, tasks }).toSatisfyStatements([
        `Exactly ${words.length} tasks with id matching input word.id, a task string containing one ___ blank, and an answer string.`,
        'Sentence around the blank is short (3-15 words) and reads like natural English when filled, with minor awkwardness acceptable.',
        'Answer is the target word/phrase or a reasonable grammatical form; the target appears only as the blank.',
      ]);
    });
  });

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
      }

      await expect({ words, tasks }).toSatisfyStatements([
        `Exactly ${words.length} tasks with id matching input word.id, an English sentence, and a Ukrainian translation.`,
        'English sentences are 3-15 words, natural, capitalized, and include the target word/phrase.',
        'Ukrainian translations are 3-15 words and read as natural, grammatical Ukrainian.',
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
      }

      await expect({ words, tasks }).toSatisfyStatements([
        `Exactly ${words.length} tasks with id matching input word.id, a Ukrainian sentence, and an English translation.`,
        'Ukrainian sentences are 3-15 words, natural, and capitalized.',
        'English translations are 3-15 words and read as grammatical, natural English.',
      ]);
    });
  });

  describe('toSynonymAndAntonym', () => {
    it('generates synonym and antonym tasks', async () => {
      const { reasoning, tasks } = await toSynonymAndAntonym(words);
      console.log('to-synonym-and-antonym', JSON.stringify({ reasoning, tasks }, null, 2));

      expect(tasks).toHaveLength(words.length);
      expect(tasks.map((task) => task.id).toSorted()).toEqual(words.map((word) => word.id).toSorted());
      for (const task of tasks) {
        expect(task).toHaveProperty('id');
        expect(task).toHaveProperty('synonym');
        expect(task).toHaveProperty('antonym');
        expect(typeof task.synonym).toBe('string');
        expect(typeof task.antonym).toBe('string');
        expect(task.synonym.length).toBeGreaterThan(0);
        expect(task.antonym.length).toBeGreaterThan(0);
      }

      await expect({ words, tasks }).toSatisfyStatements([
        `Exactly ${words.length} tasks with id matching input word.id, plus non-empty synonym and antonym strings.`,
        'Synonym and antonym are reasonable semantic matches for the target word/phrase, and they do not repeat the target word.',
        'Use common, clear vocabulary; single words or short phrases are acceptable.',
      ]);
    });
  });
});
