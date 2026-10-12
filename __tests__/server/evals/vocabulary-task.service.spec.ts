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
        uaPattern: /[ву]перше/iu,
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
        uaTranslation: 'як води напитися',
        partOfSpeech: null,
        pattern: /\bpiece of cake\b/iu,
        uaPattern: /води напитися/iu,
        uaForbiddenPattern: /торт|тістеч|пиріг|шмат/iu,
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
    ] satisfies (Omit<VocabularyItemData, 'id'> & {
      pattern: RegExp;
      uaPattern?: RegExp;
      uaForbiddenPattern?: RegExp;
    })[]
  ).map(({ pattern, uaPattern, uaForbiddenPattern, ...data }) => ({
    item: item(data),
    pattern,
    uaPattern,
    uaForbiddenPattern,
  }));

  const items = cases.map(({ item }) => item);

  // production sends at most 6 items per call
  const chunkSize = 6;
  const chunks = Array.from({ length: Math.ceil(cases.length / chunkSize) }, (_, idx) => {
    const chunkItems = cases.slice(idx * chunkSize, (idx + 1) * chunkSize).map(({ item }) => item);

    return { name: chunkItems.map((item) => item.value).join(', '), items: chunkItems };
  });

  const findPattern = (id: string) => {
    const pattern = cases.find(({ item }) => item.id === id)?.pattern;
    if (!pattern) throw new Error(`expected a pattern for task "${id}"`);

    return pattern;
  };

  const findUaPattern = (id: string) => cases.find(({ item }) => item.id === id)?.uaPattern;

  const findUaForbiddenPattern = (id: string) => cases.find(({ item }) => item.id === id)?.uaForbiddenPattern;

  const withItems = <T extends { id: string }>(tasks: T[]) =>
    tasks.map((task) => {
      const item = items.find((item) => item.id === task.id);
      if (!item) throw new Error(`expected an item for task "${task.id}"`);

      return { item, task };
    });

  const assertTaskShape = (
    tasks: { id: string; sentence: string; translation: string }[],
    chunkItems: typeof items,
  ) => {
    expect(tasks).toHaveLength(chunkItems.length);
    expect(tasks.map((task) => task.id).toSorted()).toEqual(chunkItems.map((item) => item.id).toSorted());
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
  };

  describe('toTranslateEnglishSentence', () => {
    it.for(chunks)(
      'generates English to Ukrainian translation tasks for $name',
      async ({ items: chunkItems }, { expect }) => {
        const { reasoning, tasks } = await toTranslateEnglishSentence(chunkItems);
        console.log('to-translate-english-sentence', JSON.stringify({ reasoning, tasks }, null, 2));

        assertTaskShape(tasks, chunkItems);

        for (const task of tasks) {
          expect(task.sentence).toMatch(findPattern(task.id));
        }

        for (const task of tasks) {
          const uaPattern = findUaPattern(task.id);
          if (!uaPattern) continue;

          expect(task.translation).toMatch(uaPattern);
        }

        for (const task of tasks) {
          const uaForbiddenPattern = findUaForbiddenPattern(task.id);
          if (!uaForbiddenPattern) continue;

          expect(task.translation).not.toMatch(uaForbiddenPattern);
        }

        await Promise.all(
          withItems(tasks).map((entry) =>
            expect
              .soft(entry)
              .toPassLlmEvals([
                'task.sentence has a subject and a verb.',
                'task.sentence sounds natural to a native English speaker.',
                'task.sentence describes a concrete everyday situation, not a habit or a general truth.',
                'task.sentence does not join two full sentences together.',
                'task.sentence uses item.value in the meaning of item.uaTranslation.',
                'task.translation means the same as task.sentence.',
                'task.translation sounds natural to a native Ukrainian speaker.',
                'task.translation uses a neutral word order.',
                'task.translation avoids lists of similar words.',
              ]),
          ),
        );
      },
    );
  });

  describe('toTranslateUkrainianSentence', () => {
    it.for(chunks)(
      'generates Ukrainian to English translation tasks for $name',
      async ({ items: chunkItems }, { expect }) => {
        const { reasoning, tasks } = await toTranslateUkrainianSentence(chunkItems);
        console.log('to-translate-ukrainian-sentence', JSON.stringify({ reasoning, tasks }, null, 2));

        assertTaskShape(tasks, chunkItems);

        for (const task of tasks) {
          expect(task.translation).toMatch(findPattern(task.id));
        }

        for (const task of tasks) {
          const uaPattern = findUaPattern(task.id);
          if (!uaPattern) continue;

          expect(task.sentence).toMatch(uaPattern);
        }

        for (const task of tasks) {
          const uaForbiddenPattern = findUaForbiddenPattern(task.id);
          if (!uaForbiddenPattern) continue;

          expect(task.sentence).not.toMatch(uaForbiddenPattern);
        }

        await Promise.all(
          withItems(tasks).map((entry) =>
            expect
              .soft(entry)
              .toPassLlmEvals([
                'task.sentence sounds natural to a native Ukrainian speaker.',
                'task.translation has a subject and a verb.',
                'task.translation means the same as task.sentence.',
                'task.translation does not join two full sentences together.',
                'task.translation uses item.value in the meaning of item.uaTranslation.',
                'task.translation uses a neutral word order.',
                'task.translation avoids lists of similar words.',
              ]),
          ),
        );
      },
    );
  });
});
