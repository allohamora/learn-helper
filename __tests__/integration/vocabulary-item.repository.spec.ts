import { describe, expect, it } from 'vitest';
import { countItems } from '@/server/db/db.utils';
import { PartOfSpeech, vocabularyItem } from '@/server/db/db.schema';
import { createMissingVocabularyItems } from '@/server/vocabulary/vocabulary-item.repository';

const buildItem = (overrides: Partial<typeof vocabularyItem.$inferInsert> = {}) => ({
  value: 'run',
  definition: 'to move fast on foot',
  uaTranslation: 'бігти',
  partOfSpeech: PartOfSpeech.Verb,
  spelling: '/rʌn/',
  ...overrides,
});

describe('vocabularyItemRepository', () => {
  describe('createMissingVocabularyItems', () => {
    it('inserts new items and returns them', async () => {
      const items = await createMissingVocabularyItems([buildItem()]);

      expect(items).toHaveLength(1);
      expect(items[0]?.value).toBe('run');
      expect(await countItems(vocabularyItem)).toBe(1);
    });

    it('returns only the newly inserted items, skipping ones that already exist', async () => {
      await createMissingVocabularyItems([buildItem()]);
      const items = await createMissingVocabularyItems([buildItem(), buildItem({ value: 'walk' })]);

      expect(items).toHaveLength(1);
      expect(items[0]?.value).toBe('walk');
      expect(await countItems(vocabularyItem)).toBe(2);
    });

    it('treats items with the same value and no part of speech as duplicates (NULLS NOT DISTINCT)', async () => {
      const phrase = buildItem({ value: 'a few', partOfSpeech: undefined });

      await createMissingVocabularyItems([phrase]);
      const items = await createMissingVocabularyItems([phrase]);

      expect(items).toHaveLength(0);
      expect(await countItems(vocabularyItem)).toBe(1);
    });
  });
});
