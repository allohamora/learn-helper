import { eq } from 'drizzle-orm';
import { describe, expect, it } from 'vitest';
import { countItems } from '@/server/db/db.utils';
import { vocabularyList } from '@/server/db/db.schema';
import { db } from '@/server/db/db.service';
import { Exception } from '@/server/utils/exception.utils';
import {
  findOrCreateVocabularyListByTitle,
  getVocabularyListByIdOrThrow,
} from '@/server/vocabulary/vocabulary-list.service';

describe('vocabularyListService', () => {
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

  describe('getVocabularyListByIdOrThrow', () => {
    it('resolves with the list when it exists', async () => {
      const list = await findOrCreateVocabularyListByTitle('Oxford 5000 A1');

      await expect(getVocabularyListByIdOrThrow(list.id)).resolves.toMatchObject({ id: list.id });
    });

    it('throws not found for a non-existent list', async () => {
      await expect(getVocabularyListByIdOrThrow('00000000-0000-7000-8000-000000000000')).rejects.toThrow(Exception);
    });
  });
});
