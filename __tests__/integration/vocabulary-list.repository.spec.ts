import { eq } from 'drizzle-orm';
import { describe, expect, it } from 'vitest';
import { countItems } from '@/server/db/db.utils';
import { vocabularyList } from '@/server/db/db.schema';
import { db } from '@/server/db/db.service';
import { findOrCreateVocabularyListByTitle } from '@/server/vocabulary/vocabulary-list.repository';

describe('vocabularyListRepository', () => {
  describe('findOrCreateVocabularyListByTitle', () => {
    it('creates a new list on first call', async () => {
      const list = await findOrCreateVocabularyListByTitle('Oxford 5000 A1');
      expect(list.title).toBe('Oxford 5000 A1');

      const found = await db.query.vocabularyList.findFirst({ where: eq(vocabularyList.title, 'Oxford 5000 A1') });
      expect(found?.id).toBe(list.id);
    });

    it('returns the existing list on repeated calls without creating a duplicate', async () => {
      const first = await findOrCreateVocabularyListByTitle('Oxford 5000 A1');
      const second = await findOrCreateVocabularyListByTitle('Oxford 5000 A1');

      expect(second.id).toBe(first.id);
      expect(await countItems(vocabularyList)).toBe(1);
    });
  });
});
