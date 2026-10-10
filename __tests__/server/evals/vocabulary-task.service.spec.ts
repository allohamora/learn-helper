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
  const hasBadSpacing = (value: string) => /\s{2,}|\s[,.!?]/u.test(value);

  const item = (data: Omit<VocabularyItemData, 'id'>) => ({
    id: uuidv7(),
    ...data,
  });

  const cases = (
    [
      {
        value: 'a',
        uaTranslation: 'неозначений артикль',
        partOfSpeech: 'indefinite article',
        pattern: /\b(?:a|an)\b/iu,
      },
      {
        value: 'can',
        uaTranslation: 'могти',
        partOfSpeech: 'modal verb',
        pattern: /\b(?:can|cannot|could)\b/iu,
        uaPattern: /мож|мог|міг/iu,
      },
      {
        value: 'be going to do (sth)',
        uaTranslation: 'збиратися (щось) зробити',
        partOfSpeech: null,
        pattern: /(?:\b(?:am|is|are|was|were|be)|['’](?:m|s|re))\s+going to do\s+\S/iu,
        uaPattern: /збира/iu,
      },
      {
        value: 'for the first time',
        uaTranslation: 'вперше',
        partOfSpeech: null,
        pattern: /\bfor the first time\b/iu,
        uaPattern: /вперше/iu,
      },
      {
        value: 'take (sb) out',
        uaTranslation: 'запрошувати (когось) кудись',
        partOfSpeech: null,
        pattern: /\b(?:take|takes|took|taken|taking)\s+(?:\S+\s+)+?out\b/iu,
        uaPattern: /запро[шс]/iu,
      },
      {
        value: 'piece of cake',
        uaTranslation: 'раз плюнути',
        partOfSpeech: null,
        pattern: /\bpiece of cake\b/iu,
        uaPattern: /плюнути/iu,
      },
      {
        value: 'ability',
        uaTranslation: 'здатність',
        partOfSpeech: 'noun',
        pattern: /\babilit(?:y|ies)\b/iu,
        uaPattern: /здатн/iu,
      },
      {
        value: 'challenge',
        uaTranslation: 'виклик',
        partOfSpeech: 'noun',
        pattern: /\bchallenges?\b/iu,
        uaPattern: /виклик/iu,
      },
      {
        value: 'abandon',
        uaTranslation: 'залишати напризволяще',
        partOfSpeech: 'verb',
        pattern: /\babandon(?:s|ed|ing)?\b/iu,
        uaPattern: /напризволяще/iu,
      },
      {
        value: 'absence',
        uaTranslation: 'відсутність',
        partOfSpeech: 'noun',
        pattern: /\babsences?\b/iu,
        uaPattern: /відсутн/iu,
      },
      { value: 'bat', uaTranslation: 'кажан', partOfSpeech: 'noun', pattern: /\bbats?\b/iu, uaPattern: /кажан/iu },
    ] satisfies (Omit<VocabularyItemData, 'id'> & { pattern: RegExp; uaPattern?: RegExp })[]
  ).map(({ pattern, uaPattern, ...data }) => ({ item: item(data), pattern, uaPattern }));

  const items = cases.map(({ item }) => item);

  const findPattern = (id: string) => {
    const pattern = cases.find(({ item }) => item.id === id)?.pattern;
    if (!pattern) throw new Error(`expected a pattern for task "${id}"`);

    return pattern;
  };

  const findUaPattern = (id: string) => cases.find(({ item }) => item.id === id)?.uaPattern;

  const pieceOfCakeId = cases.find(({ item }) => item.value === 'piece of cake')?.item.id;

  const withItems = <T extends { id: string }>(tasks: T[]) =>
    tasks.map((task) => {
      const item = items.find((item) => item.id === task.id);
      if (!item) throw new Error(`expected an item for task "${task.id}"`);

      return { item, task };
    });

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
        expect(hasParenthesizedPlaceholder(task.sentence)).toBe(false);
        expect(hasParenthesizedPlaceholder(task.translation)).toBe(false);
        expect(hasBadSpacing(task.sentence)).toBe(false);
        expect(hasBadSpacing(task.translation)).toBe(false);
      }

      for (const task of tasks) {
        expect(task.sentence).toMatch(findPattern(task.id));
      }

      for (const task of tasks) {
        const uaPattern = findUaPattern(task.id);
        if (!uaPattern) continue;

        expect(task.translation).toMatch(uaPattern);
      }

      expect(tasks.find((task) => task.id === pieceOfCakeId)?.translation).not.toMatch(/торт|тістеч|пиріг|шмат/iu);

      await expect(withItems(tasks)).toPassLlmEvals([
        'Each English sentence has a subject and a verb.',
        'Each English sentence sounds natural to a native speaker.',
        'Each English sentence is set in a specific everyday situation.',
        'Each English sentence does not join two full sentences together.',
        'Each English sentence uses its item in the meaning of the item uaTranslation.',
        'Each Ukrainian translation means the same as its English sentence.',
        'Each Ukrainian translation sounds natural to a native speaker.',
        'Each Ukrainian translation uses a neutral word order.',
        'Each Ukrainian translation avoids lists of similar words.',
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
        expect(hasParenthesizedPlaceholder(task.sentence)).toBe(false);
        expect(hasParenthesizedPlaceholder(task.translation)).toBe(false);
        expect(hasBadSpacing(task.sentence)).toBe(false);
        expect(hasBadSpacing(task.translation)).toBe(false);
      }

      for (const task of tasks) {
        expect(task.translation).toMatch(findPattern(task.id));
      }

      for (const task of tasks) {
        const uaPattern = findUaPattern(task.id);
        if (!uaPattern) continue;

        expect(task.sentence).toMatch(uaPattern);
      }

      expect(tasks.find((task) => task.id === pieceOfCakeId)?.sentence).not.toMatch(/торт|тістеч|пиріг|шмат/iu);

      await expect(withItems(tasks)).toPassLlmEvals([
        'Each Ukrainian sentence sounds natural to a native speaker.',
        'Each English translation has a subject and a verb.',
        'Each English translation means the same as its Ukrainian sentence.',
        'Each English translation does not join two full sentences together.',
        'Each English translation uses its item in the meaning of the item uaTranslation.',
        'Each English translation uses a neutral word order.',
        'Each English translation avoids lists of similar words.',
      ]);
    });
  });
});
