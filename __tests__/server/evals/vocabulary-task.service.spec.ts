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
      { value: 'a', uaTranslation: 'неозначений артикль', partOfSpeech: 'indefinite article' },
      { value: 'can', uaTranslation: 'могти', partOfSpeech: 'modal verb' },
      { value: 'be going to do (sth)', uaTranslation: 'збиратися (щось) зробити', partOfSpeech: null },
      { value: 'for the first time', uaTranslation: 'вперше', partOfSpeech: null },
      { value: 'take (sb) out', uaTranslation: 'запрошувати (когось) кудись', partOfSpeech: null },
      { value: 'piece of cake', uaTranslation: 'раз плюнути', partOfSpeech: null },
      { value: 'ability', uaTranslation: 'здатність', partOfSpeech: 'noun' },
      { value: 'challenge', uaTranslation: 'виклик', partOfSpeech: 'noun' },
      { value: 'abandon', uaTranslation: 'залишати напризволяще', partOfSpeech: 'verb' },
      { value: 'absence', uaTranslation: 'відсутність', partOfSpeech: 'noun' },
      { value: 'bat', uaTranslation: 'кажан', partOfSpeech: 'noun' },
    ] satisfies Omit<VocabularyItemData, 'id'>[]
  ).map((data) => item(data));

  const findTaskByValue = <T extends { id: string }>(tasks: T[], value: string) =>
    tasks.find((task) => task.id === items.find((item) => item.value === value)?.id);

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
      }

      const phrasalVerbTask = findTaskByValue(tasks, 'take (sb) out');
      expect(phrasalVerbTask?.sentence).toMatch(/\b(?:take|takes|took|taken|taking)\b[\s\S]*\bout\b/iu);

      const articleTask = findTaskByValue(tasks, 'a');
      expect(articleTask?.sentence).toMatch(/\b(?:a|an)\b/iu);

      await expect(withItems(tasks)).toPassLlmEvals([
        'Each English sentence is one natural sentence with a subject and a verb.',
        'Each English sentence is set in a specific everyday situation.',
        'Each English sentence does not join two full sentences together.',
        'Each English sentence contains every word of its item value, including short words like "a", in the same order, where a word may change its form, like a verb form, "a" becoming "an", or "be" becoming "am", "is", "are", "was", or "were".',
        'Each English sentence may add extra words before or after the value.',
        'Each English sentence replaces a placeholder like (sb) or (sth) with a word, when its item has one.',
        'Each English sentence uses its item in the meaning of the item uaTranslation.',
        'For the item "a", any "a" or "an" before a noun counts, also at the start of the sentence.',
        'For the item "a", the sentence does not need to be about articles.',
        'Each Ukrainian translation means the same as its English sentence.',
        'Each Ukrainian translation sounds natural to a native speaker.',
        'Each Ukrainian translation may use different valid word forms and word orders.',
        'Each Ukrainian translation uses a neutral word order, allowing some flexibility.',
        'Each Ukrainian translation avoids lists of similar words.',
        'For the item "piece of cake", the Ukrainian translation translates it like its uaTranslation and is not about cake.',
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
      }

      const phrasalVerbTask = findTaskByValue(tasks, 'take (sb) out');
      expect(phrasalVerbTask?.translation).toMatch(/\b(?:take|takes|took|taken|taking)\b[\s\S]*\bout\b/iu);

      const articleTask = findTaskByValue(tasks, 'a');
      expect(articleTask?.translation).toMatch(/\b(?:a|an)\b/iu);

      await expect(withItems(tasks)).toPassLlmEvals([
        'Each Ukrainian sentence is one natural sentence that sounds right to a native speaker.',
        'Each Ukrainian sentence may use different valid word forms and word orders.',
        'Each English translation is one sentence with a subject and a verb.',
        'Each English translation means the same as its Ukrainian sentence.',
        'Each English translation does not join two full sentences together.',
        'Each English translation contains every word of its item value, including short words like "a", in the same order, where a word may change its form, like a verb form, "a" becoming "an", or "be" becoming "am", "is", "are", "was", or "were".',
        'Each English translation may add extra words before or after the value.',
        'Each English translation replaces a placeholder like (sb) or (sth) with a word, when its item has one.',
        'Each English translation uses its item in the meaning of the item uaTranslation.',
        'For the item "a", any "a" or "an" before a noun counts, also at the start of the sentence.',
        'For the item "a", the translation does not need to be about articles.',
        'Each English translation uses a neutral word order, allowing some flexibility.',
        'Each English translation avoids lists of similar words.',
        'For the item "piece of cake", the Ukrainian sentence translates it like its uaTranslation and is not about cake.',
      ]);
    });
  });
});
