import { describe, expect, it } from 'vitest';
import {
  toTranslateEnglishSentence,
  toTranslateUkrainianSentence,
  type VocabularyItemData,
} from '@/server/user-vocabulary/vocabulary-task.service';
import { uuidv7 } from 'uuidv7';

describe.concurrent('vocabulary-task.service', () => {
  const countWordsBySpaces = (value: string) => {
    const trimmedValue = value.trim();

    if (!trimmedValue) {
      return 0;
    }

    return trimmedValue.split(/\s+/u).length;
  };

  const hasForbiddenSemicolonOrColon = (value: string) => /[;:]/gim.test(value);
  const hasForbiddenDash = (value: string) => /[-–—]/gim.test(value);
  const hasParenthesizedPlaceholder = (value: string) => /\([^)]*\)/gim.test(value);

  const item = (data: Omit<VocabularyItemData, 'id'>) => ({
    id: uuidv7(),
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

  const findTaskByValue = <T extends { id: string }>(tasks: T[], value: string) =>
    tasks.find((task) => task.id === items.find((item) => item.value === value)?.id);

  describe('toTranslateEnglishSentence', () => {
    it('generates English to Ukrainian translation tasks', async () => {
      const { tasks } = await toTranslateEnglishSentence(items);
      console.log('to-translate-english-sentence', JSON.stringify({ tasks }, null, 2));

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
        expect(hasParenthesizedPlaceholder(task.sentence)).toBe(false);
        expect(hasParenthesizedPlaceholder(task.translation)).toBe(false);
      }

      const phrasalVerbTask = findTaskByValue(tasks, 'take (sb) out');
      expect(phrasalVerbTask?.sentence).toMatch(/\b(?:take|takes|took|taken|taking)\b[\s\S]*\bout\b/iu);

      const articleTask = findTaskByValue(tasks, 'a');
      expect(articleTask?.sentence).toMatch(/\b(?:a|an)\b/iu);

      await expect({ items, tasks }).toSatisfyStatements([
        `Exactly ${items.length} tasks with id matching input item.id, an English sentence, and a Ukrainian translation.`,
        'English sentences are complete sentences with a subject and a verb (not a fragment), max 15 words, natural, sentence case.',
        'English sentences contain every word of the target phrase, in order, with the target\'s own words never reordered or replaced with synonyms - the ONLY change allowed to a target word is a minimal verb/auxiliary inflection (e.g., "be going to" -> "is going to") or rendering "a" as "an" when grammatically required before a vowel sound. All function words unchanged. The sentence may naturally include additional surrounding words for context beyond the target phrase itself.',
        'Parenthesized placeholders (e.g. "(sb)", "(sth)") are replaced with a concrete word and never appear literally in the sentence.',
        'Sentences use specific real-world context, not vague or abstract phrases.',
        'Ukrainian translations are max 15 words, sentence case, single spaces, punctuation attached to tokens. No dashes (–, —). Must sound natural and idiomatic to a native Ukrainian speaker, not word-for-word from English.',
        'Single sentence only. No semicolons, colons, or dashes. No joined independent clauses.',
        'Ukrainian translations have one unambiguous word order when shuffled, with pronouns/prepositions/conjunctions/particles as separate tokens.',
        'Ukrainian translations use correct adjective-noun agreement (gender, number, case) and are otherwise generally grammatical. Do NOT flag declension variations as errors. Both singular and plural accusative/genitive forms are valid (e.g., "бабусю і дідуся", "бабусів і дідусів", "бабусь і дідусів" are all acceptable).',
      ]);
    });
  });

  describe('toTranslateUkrainianSentence', () => {
    it('generates Ukrainian to English translation tasks', async () => {
      const { tasks } = await toTranslateUkrainianSentence(items);
      console.log('to-translate-ukrainian-sentence', JSON.stringify({ tasks }, null, 2));

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
        expect(hasParenthesizedPlaceholder(task.sentence)).toBe(false);
        expect(hasParenthesizedPlaceholder(task.translation)).toBe(false);
      }

      const phrasalVerbTask = findTaskByValue(tasks, 'take (sb) out');
      expect(phrasalVerbTask?.translation).toMatch(/\b(?:take|takes|took|taken|taking)\b[\s\S]*\bout\b/iu);

      const articleTask = findTaskByValue(tasks, 'a');
      expect(articleTask?.translation).toMatch(/\b(?:a|an)\b/iu);

      await expect({ items, tasks }).toSatisfyStatements([
        `Exactly ${items.length} tasks with id matching input item.id, a Ukrainian sentence, and an English translation.`,
        'Ukrainian sentences are max 15 words, sentence case. No dashes (–, —). Must sound natural and idiomatic to a native Ukrainian speaker, not word-for-word from English. Do NOT flag grammar style preferences as errors. Accept all valid Ukrainian constructions: alternative declension forms (e.g., "бабусю і дідуся" and "бабусів і дідусів" are both valid), active impersonal voice (e.g., "покинули") alongside passive (e.g., "було покинуто"), and flexible word order.',
        'English translations are complete sentences with a subject and a verb (not a fragment), max 15 words, sentence case.',
        'English translations contain every word of the target phrase, in order, with the target\'s own words never reordered or replaced with synonyms - the ONLY change allowed to a target word is a minimal verb/auxiliary inflection (e.g., "be going to" -> "is going to") or rendering "a" as "an" when grammatically required before a vowel sound. All function words unchanged. The translation may naturally include additional surrounding words for context beyond the target phrase itself.',
        'Parenthesized placeholders (e.g. "(sb)", "(sth)") are replaced with a concrete word and never appear literally in the translation.',
        'English translations use single spaces, punctuation attached to tokens. Include required articles/prepositions/auxiliaries as separate tokens.',
        'Single sentence only. No semicolons, colons, or dashes. No joined independent clauses.',
        'English translations have one unambiguous word order when shuffled.',
        'Sentences use specific real-world context, not vague or abstract phrases.',
      ]);
    });
  });
});
