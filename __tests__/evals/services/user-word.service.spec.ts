import { describe, expect, it } from 'vitest';
import {
  toFillInTheGap,
  toTranslateEnglishSentence,
  toTranslateUkrainianSentence,
  toSynonymAndAntonym,
  toFindNonsenseSentence,
  toWordOrder,
  type WordData,
} from '@/services/user-word.service';
import { randomInt } from 'node:crypto';
import '__tests__/expect/to-satisfy-statements.expect';

describe.concurrent('user-word.service', () => {
  const word = (data: Omit<WordData, 'id'>) => ({
    id: randomInt(1, 10000),
    ...data,
  });

  const challenge = word({
    value: 'challenge',
    definition: "a new or difficult task that tests somebody's ability and skill",
    partOfSpeech: 'noun',
    level: 'b1',
  });

  const add = word({
    value: 'add',
    definition: 'to put something together with something else so as to increase the size, number, amount, etc',
    partOfSpeech: 'verb',
    level: 'a1',
  });

  const come = word({
    value: 'come',
    definition: 'to move to or towards a person or place',
    partOfSpeech: 'verb',
    level: 'a1',
  });

  const a = word({
    value: 'a',
    definition:
      'used before countable or singular nouns referring to people or things that have not already been mentioned',
    partOfSpeech: 'indefinite article',
    level: 'a1',
  });

  const can = word({
    value: 'can',
    definition: 'used to say that it is possible for somebody/something to do something, or for something to happen',
    partOfSpeech: 'modal verb',
    level: 'a1',
  });

  const beGoingToDo = word({
    value: 'be going to do (sth)',
    definition: 'to move or travel from one place to another',
    partOfSpeech: null,
    level: 'a1',
  });

  describe('toFillInTheGap', () => {
    it('generates fill-in-the-gap tasks for 6 words', async () => {
      const words = [beGoingToDo, challenge, a, add, come, can];
      const { tasks } = await toFillInTheGap(words);

      expect(tasks).toHaveLength(words.length);
      expect(tasks.map((task) => task.id).toSorted()).toEqual(words.map((word) => word.id).toSorted());
      for (const task of tasks) {
        expect(task).toHaveProperty('id');
        expect(task).toHaveProperty('task');
        expect(task).toHaveProperty('answer');
        expect(task.task).toContain('___');
      }

      await expect({ words, tasks }).toSatisfyStatements([
        'Tasks contain exactly 6 entries with id, task, and answer fields.',
        'Each task sentence contains exactly one ___ (three underscores as a single blank).',
        'All task sentences are complete, natural, modern English between 5-15 words.',
        'Each task answer field contains the exact target word or phrase that correctly fits the blank.',
        'The target word/phrase does not appear anywhere else in the sentence except as the blank.',
        'The 6 task sentences have different structures and contexts - no repetition.',
        'The task can exclude optional clarifications like (sb) or (sth) in the answer.',
        'The task can use different grammatical forms of the target word if appropriate (e.g., be => was, user => users).',
      ]);
    });
  });

  describe('toTranslateEnglishSentence', () => {
    it('generates English to Ukrainian translation tasks for 6 words', async () => {
      const words = [beGoingToDo, challenge, a, add, come, can];
      const { tasks } = await toTranslateEnglishSentence(words);

      expect(tasks).toHaveLength(words.length);
      expect(tasks.map((task) => task.id).toSorted()).toEqual(words.map((word) => word.id).toSorted());
      for (const task of tasks) {
        expect(task).toHaveProperty('id');
        expect(task).toHaveProperty('sentence');
        expect(task).toHaveProperty('options');
        expect(task.options).toHaveLength(4);
        expect(task.options.filter((opt) => opt.isAnswer)).toHaveLength(1);
      }

      await expect({ words, tasks }).toSatisfyStatements([
        'Tasks contain exactly 6 entries with id, sentence, and options fields.',
        'Each task English sentence is concise (1-12 words), modern, and natural, including or clearly expressing the target word/phrase.',
        'Each task has exactly 4 Ukrainian translation options.',
        'Exactly one option per task has isAnswer: true.',
        'The correct Ukrainian translation precisely reflects the meaning of the English sentence.',
        'Incorrect translations are grammatically correct and natural but differ slightly in meaning (wrong preposition, verb, or adjective).',
        'All Ukrainian sentences sound fluent and natural for native speakers.',
        'No repetition of topics, subjects, or sentence patterns across tasks.',
      ]);
    });
  });

  describe('toTranslateUkrainianSentence', () => {
    it('generates Ukrainian to English translation tasks for 6 words', async () => {
      const words = [beGoingToDo, challenge, a, add, come, can];
      const { tasks } = await toTranslateUkrainianSentence(words);

      expect(tasks).toHaveLength(words.length);
      expect(tasks.map((task) => task.id).toSorted()).toEqual(words.map((word) => word.id).toSorted());
      for (const task of tasks) {
        expect(task).toHaveProperty('id');
        expect(task).toHaveProperty('sentence');
        expect(task).toHaveProperty('options');
        expect(task.options).toHaveLength(4);
        expect(task.options.filter((opt) => opt.isAnswer)).toHaveLength(1);
      }

      await expect({ words, tasks }).toSatisfyStatements([
        'Tasks contain exactly 6 entries with id, sentence, and options fields.',
        'Each task.id matches the corresponding input word.id.',
        'Each Ukrainian sentence is short (1-12 words), natural, modern, and exactly one sentence.',
        'Each task has exactly 4 English translation options as complete sentences (not single words or fragments).',
        'Exactly one option per task has isAnswer: true and includes the exact English word/phrase from input (case-insensitive match, allowing capitalization at sentence start).',
        'The correct option fully translates the entire Ukrainian sentence.',
        'All English options are complete, natural sentences.',
        'Incorrect options are natural but differ slightly (wrong preposition, similar verb, or altered adjective).',
        'Topics and sentence patterns are varied; no repetition.',
        'The task can use different grammatical forms of the target word if appropriate (e.g., be => was, user => users, go out with (sth) => go out with her).',
      ]);
    });
  });

  describe('toSynonymAndAntonym', () => {
    it('generates synonym and antonym tasks for 6 words', async () => {
      const words = [beGoingToDo, challenge, a, add, come, can];
      const { tasks } = await toSynonymAndAntonym(words);

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
        'Tasks contain exactly 6 entries with id, synonym, and antonym fields.',
        'Each task.id matches the corresponding input word.id.',
        'Each task synonym has similar meaning to the target word based on its most common meaning.',
        'Each task antonym has opposite meaning to the target word.',
        'Task synonyms and antonyms use clear, common, learner-friendly vocabulary.',
        'Prefer single-word answers; use short phrases only when necessary.',
        'Synonyms and antonyms match the part of speech and approximate difficulty of the target word.',
        'Neither synonym nor antonym repeats the target word itself.',
        'All task entries are natural, lowercase (unless proper nouns), and free of quotes or punctuation.',
        'Avoid rare, archaic, or overly technical words.',
      ]);
    });
  });

  describe('toFindNonsenseSentence', () => {
    it('generates nonsense detection tasks for 6 words', async () => {
      const words = [beGoingToDo, challenge, a, add, come, can];
      const { tasks } = await toFindNonsenseSentence(words);

      expect(tasks).toHaveLength(words.length);
      expect(tasks.map((task) => task.id).toSorted()).toEqual(words.map((word) => word.id).toSorted());
      for (const task of tasks) {
        expect(task).toHaveProperty('id');
        expect(task).toHaveProperty('options');
        expect(task.options).toHaveLength(4);
        expect(task.options.filter((opt) => opt.isAnswer)).toHaveLength(1);
        expect(task.options.filter((opt) => !opt.isAnswer)).toHaveLength(3);
        const nonsense = task.options.find((opt) => opt.isAnswer);
        expect(nonsense?.description).toBeDefined();
      }

      await expect({ words, tasks }).toSatisfyStatements([
        'Tasks contain exactly 6 entries with id and options fields.',
        'Each task.id matches the corresponding input word.id.',
        'Each task has exactly 4 sentence options.',
        'All task sentences contain the target word or phrase.',
        'Per task: exactly 3 correct sentences (isAnswer: false) using the word/phrase CORRECTLY - natural, well-formed, demonstrating proper usage.',
        'Per task: exactly 1 incorrect sentence (isAnswer: true) using it INCORRECTLY - nonsensical, impossible, or grammatically broken, clearly meaningless to a native speaker.',
        'The incorrect sentence is not just unusual or less natural; it is obviously wrong, absurd, or completely illogical.',
        'Only the incorrect sentence has a description field that briefly explains why it is nonsense or incorrect.',
        'All sentences are complete, natural English (3-15 words).',
        'No repetition of sentence topics or patterns across tasks.',
      ]);
    });
  });

  describe('toWordOrder', () => {
    it('generates word order tasks for 6 words', async () => {
      const words = [beGoingToDo, challenge, a, add, come, can];
      const { tasks } = await toWordOrder(words);

      expect(tasks).toHaveLength(words.length);
      expect(tasks.map((task) => task.id).toSorted()).toEqual(words.map((word) => word.id).toSorted());
      for (const task of tasks) {
        expect(task).toHaveProperty('id');
        expect(task).toHaveProperty('sentence');
        expect(typeof task.sentence).toBe('string');
        expect(task.sentence.length).toBeGreaterThan(0);
        expect(task.sentence[0]).toBe(task.sentence[0]?.toUpperCase());
      }

      await expect({ words, tasks }).toSatisfyStatements([
        'Tasks contain exactly 6 entries with id and sentence fields.',
        'Each task.id matches the corresponding input word.id.',
        'All task sentences are in the CORRECT order (this is the answer key).',
        'Each sentence is a single string with words separated by single spaces.',
        'All task sentences are natural, modern English between 5-15 words.',
        'The target word or phrase appears in each sentence.',
        'Task first word is capitalized.',
        'Articles (a, an, the), prepositions, and function words are included as separate words.',
        'Sentences are unique; no repetition of structures or contexts.',
      ]);
    });
  });
});
