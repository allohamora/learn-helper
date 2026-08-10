import { eq } from 'drizzle-orm';
import { describe, expect, it } from 'vitest';
import { countItems } from '@/server/db/db.utils';
import { db } from '@/server/db/db.service';
import { vocabularyItem } from '@/server/db/db.schema';
import {
  createMissingVocabularyItems,
  searchVocabularyItems,
  updateVocabularyItemTranslation,
} from '@/server/vocabulary/vocabulary-item.repository';
import { PartOfSpeech } from '@/const/vocabulary';
import { RequestType } from '@/const/request';

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

  describe('updateVocabularyItemTranslation', () => {
    it("updates the item's translation", async () => {
      const [item] = await createMissingVocabularyItems([buildItem()]);
      if (!item) throw new Error('expected item to be created');

      await updateVocabularyItemTranslation({ vocabularyItemId: item.id, uaTranslation: 'бігати' });

      const updated = await db.query.vocabularyItem.findFirst({ where: eq(vocabularyItem.id, item.id) });
      expect(updated?.uaTranslation).toBe('бігати');
    });
  });

  describe('searchVocabularyItems', () => {
    it('matches values case-insensitively via ILIKE', async () => {
      await createMissingVocabularyItems([buildItem({ value: 'Run' }), buildItem({ value: 'walk' })]);

      const result = await searchVocabularyItems({ value: 'run' });

      expect(result.items.map((item) => item.value)).toEqual(['Run']);
      expect(result.total).toBe(1);
    });

    it('returns an empty list and total 0 when nothing matches', async () => {
      await createMissingVocabularyItems([buildItem({ value: 'run' })]);

      const result = await searchVocabularyItems({ value: 'xyz' });

      expect(result.items).toEqual([]);
      expect(result.total).toBe(0);
    });

    it('paginates with a cursor and returns nextCursor when more items remain', async () => {
      await createMissingVocabularyItems([
        buildItem({ value: 'run1' }),
        buildItem({ value: 'run2' }),
        buildItem({ value: 'run3' }),
      ]);

      const firstPage = await searchVocabularyItems({ value: 'run', limit: 2 });
      expect(firstPage.items).toHaveLength(2);
      expect(firstPage.nextCursor).toBeDefined();

      const secondPage = await searchVocabularyItems({ value: 'run', limit: 2, cursor: firstPage.nextCursor });
      expect(secondPage.items).toHaveLength(1);
      expect(secondPage.nextCursor).toBeUndefined();

      const pagedValues = [...firstPage.items, ...secondPage.items].map((item) => item.value);
      expect(new Set(pagedValues)).toEqual(new Set(['run1', 'run2', 'run3']));
    });

    it('skips the total count query and returns total: 0 when type is Data', async () => {
      await createMissingVocabularyItems([buildItem({ value: 'run' })]);

      const result = await searchVocabularyItems({ value: 'run', type: RequestType.Data });

      expect(result.items).toHaveLength(1);
      expect(result.total).toBe(0);
    });

    it('matches a literal % instead of treating it as a wildcard', async () => {
      await createMissingVocabularyItems([buildItem({ value: '100%' }), buildItem({ value: '100' })]);

      const result = await searchVocabularyItems({ value: '100%' });

      expect(result.items.map((item) => item.value)).toEqual(['100%']);
    });

    it('matches a literal _ instead of treating it as a single-character wildcard', async () => {
      await createMissingVocabularyItems([buildItem({ value: 'foo_bar' }), buildItem({ value: 'fooxbar' })]);

      const result = await searchVocabularyItems({ value: 'foo_bar' });

      expect(result.items.map((item) => item.value)).toEqual(['foo_bar']);
    });

    it('matches a literal backslash', async () => {
      await createMissingVocabularyItems([buildItem({ value: 'a\\b' }), buildItem({ value: 'ab' })]);

      const result = await searchVocabularyItems({ value: 'a\\b' });

      expect(result.items.map((item) => item.value)).toEqual(['a\\b']);
    });
  });
});
