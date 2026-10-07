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
      { value: 'take (sb) out', uaTranslation: 'запросити (когось) кудись', partOfSpeech: null },
      { value: 'ability', uaTranslation: 'здатність', partOfSpeech: 'noun' },
      { value: 'challenge', uaTranslation: 'виклик', partOfSpeech: 'noun' },
      { value: 'abandon', uaTranslation: 'залишати напризволяще', partOfSpeech: 'verb' },
      { value: 'absence', uaTranslation: 'відсутність', partOfSpeech: 'noun' },
      { value: 'bat', uaTranslation: 'кажан', partOfSpeech: 'noun' },
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
        'Each English sentence is one natural sentence with a subject and a verb, set in a specific everyday situation. It does not join two full sentences together.',
        'Each English sentence contains every word of its item value in the same order. Only grammar changes are allowed, such as a verb form or "a" becoming "an". Extra words may come before or after, and a placeholder like (sb) or (sth) is replaced by a word.',
        'Each English sentence uses its item in the meaning of the item uaTranslation. A function word like "a" only needs to appear in its normal role in the sentence.',
        'Each Ukrainian translation means the same as its English sentence and sounds natural to a native speaker. Different valid word forms and word orders are fine.',
        'Each Ukrainian translation uses a neutral word order and avoids lists of similar words. Some flexibility in word order is fine.',
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
        'Each Ukrainian sentence is one natural sentence that sounds right to a native speaker. Different valid word forms, active or passive voice, and word orders are fine.',
        'Each English translation is one sentence with a subject and a verb, and means the same as its Ukrainian sentence. It does not join two full sentences together.',
        'Each English translation contains every word of its item value in the same order. Only grammar changes are allowed, such as a verb form or "a" becoming "an". Extra words may come before or after, and a placeholder like (sb) or (sth) is replaced by a word.',
        'Each English translation uses its item in the meaning of the item uaTranslation. A function word like "a" only needs to appear in its normal role in the sentence.',
        'Each English translation uses a neutral word order and avoids lists of similar words. Some flexibility in word order is fine.',
      ]);
    });
  });
});
