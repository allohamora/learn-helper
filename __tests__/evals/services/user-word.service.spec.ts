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
        `Exactly ${words.length} tasks, each with id matching input word.id, task field with one ___ blank, and answer field.`,
        'CRITICAL: Each task.task must contain exactly one ___ (three underscores) as a blank placeholder.',
        'Sentences are 3-15 words, natural modern English. When the blank is filled with the answer, the sentence should be comprehensible - however, "a"/"an" mismatches (e.g., "a interesting" instead of "an interesting") are acceptable, as well as occasional awkward phrasing.',
        'Answer is target word/phrase or grammatical adaptation (e.g., "be going to do (sth)"→"are going to", conjugated verb forms). Target appears only as blank.',
        'Tasks cover various CEFR levels, which is expected.',
      ]);
    });
  });

  describe('toTranslateEnglishSentence', () => {
    it('generates English to Ukrainian translation tasks', async () => {
      const { tasks, reasoning } = await toTranslateEnglishSentence(words);
      console.log('to-translate-english-sentence', JSON.stringify({ reasoning, tasks }, null, 2));

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
        `Exactly ${words.length} tasks, each with id matching input word.id, English sentence (3-15 words with target word), and 4 Ukrainian options.`,
        'Exactly one option per task has isAnswer: true. Correct option translates the English sentence in natural Ukrainian. Minor grammatical case variations (e.g., nominative "кіт" instead of accusative "кота") are acceptable as long as the sentence is understandable.',
        'All 4 options are Ukrainian sentences. Minor grammatical imperfections are acceptable if the meaning is clear.',
        'Wrong options stay in same topic/context but differ in verb/noun/tense/subject (e.g., "do homework"→"finished homework", not "buy book").',
        'Prefer one valid translation, but minor variations are acceptable.',
        'Tasks cover various CEFR levels (A1-C1), which is expected and acceptable.',
      ]);
    });
  });

  describe('toTranslateUkrainianSentence', () => {
    it('generates Ukrainian to English translation tasks', async () => {
      const { tasks, reasoning } = await toTranslateUkrainianSentence(words);
      console.log('to-translate-ukrainian-sentence', JSON.stringify({ reasoning, tasks }, null, 2));

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
        `Exactly ${words.length} tasks, each with id matching input word.id, Ukrainian sentence (3-15 words), and 4 English options.`,
        'Exactly one option per task has isAnswer: true and includes target word/phrase or natural variation. Correct option translates Ukrainian sentence.',
        'All 4 options are English sentences. Minor grammatical issues (e.g., tense mismatch like "buys...last year") are acceptable if meaning is clear.',
        'Wrong options stay in same topic/context but differ in verb/noun/tense/subject. Target word may appear in wrong options if used differently (e.g., different tense/form).',
        'Prefer one valid translation, but variations are acceptable.',
        'Tasks cover various CEFR levels (A1-C1), which is expected.',
        'Minor unnatural issues like "своїх бабусю та дідуся" instead of "своїх бабусь та дідусів" are acceptable as long as the meaning is clear and grammatically correct.',
      ]);
    });
  });

  describe('toSynonymAndAntonym', () => {
    it('generates synonym and antonym tasks', async () => {
      const { tasks, reasoning } = await toSynonymAndAntonym(words);
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
        `Exactly ${words.length} tasks with id, synonym, antonym fields. Task ids match input word ids.`,
        'CRITICAL: Both synonym AND antonym fields must be non-empty strings. Empty strings are NOT acceptable - a valid word or phrase must be provided for each field.',
        'Synonyms/antonyms based on definition field. Synonym/antonym positions may be swapped if both represent semantically valid relationships (e.g., if "presence" is given as synonym for "absence", this is acceptable as it shows a valid semantic relationship even if reversed). Part of speech null for phrases is acceptable.',
        'Clear, common vocabulary. Single words preferred, but phrases (2-4 words) are fully acceptable. Antonyms do not need to be direct opposites - semantically related contrasting phrases are valid (e.g., for "abandon": antonym could be "stay with", "keep", or "hold onto"). No target word repetition.',
        'Natural, lowercase format (hyphens ok). For articles: "a"→synonym "an", antonym "the" (or similar valid article relationships). Note: INPUT words may contain parentheses like "(sth)" - this refers to the source data, not the output.',
      ]);
    });
  });

  describe('toFindNonsenseSentence', () => {
    it('generates nonsense detection tasks', async () => {
      const { tasks, reasoning } = await toFindNonsenseSentence(words);
      console.log('to-find-nonsense-sentence', JSON.stringify({ reasoning, tasks }, null, 2));

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
        `Exactly ${words.length} tasks, each with id matching input word.id and exactly 4 sentence options containing target word/phrase or natural variation (e.g., "for the first time"→"my first time").`,
        'Options are 3-15 words, natural modern English.',
        'CRITICAL: Per task must have exactly 3 correct sentences (isAnswer: false) and exactly 1 nonsense (isAnswer: true).',
        'CRITICAL: Nonsense sentence (isAnswer: true) MUST have description field explaining why wrong. Nonsense obviously absurd/impossible/meaningless (e.g., chair swims, do it yesterday).',
        'Tasks use words from various CEFR levels (A1-C1). Sentence complexity should generally match word level, but simpler grammar for higher-level words is acceptable as long as usage is correct.',
      ]);
    });
  });

  describe('toWordOrder', () => {
    it('generates word order tasks', async () => {
      const { tasks } = await toWordOrder(words);
      console.log('to-word-order', JSON.stringify(tasks, null, 2));

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
        `Exactly ${words.length} tasks with id matching input word.id and sentence in CORRECT word order (answer key).`,
        'Sentences are 3-15 words, natural modern English, single-space separated, first word capitalized, punctuation attached to words.',
        'Target word/phrase or natural variation appears (e.g., "for the first time"→"my first time", "be going to do"→"are going to visit").',
        'Articles, prepositions, function words are separate. Multi-word phrases split into separate words.',
        'Level-appropriate grammar preferred: A1 simple, B1 ideally conditionals, B2+ advanced - but variations acceptable as long as sentences are natural and demonstrate proper word usage.',
      ]);
    });
  });
});
