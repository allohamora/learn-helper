import { describe, expect, it } from 'vitest';
import {
  getVocabularyListById,
  getVocabularyListByTitle,
  insertVocabularyListIgnoringConflict,
} from '@/server/vocabulary/vocabulary-list.repository';

describe('vocabularyListRepository', () => {
  describe('insertVocabularyListIgnoringConflict', () => {
    it('inserts a new list and returns it', async () => {
      const inserted = await insertVocabularyListIgnoringConflict('Oxford 5000 A1');

      expect(inserted).toMatchObject({ title: 'Oxford 5000 A1' });
    });

    it('returns undefined when a list with the same title already exists', async () => {
      await insertVocabularyListIgnoringConflict('Oxford 5000 A1');

      const inserted = await insertVocabularyListIgnoringConflict('Oxford 5000 A1');

      expect(inserted).toBeUndefined();
    });
  });

  describe('getVocabularyListByTitle', () => {
    it('returns the list matching the title', async () => {
      const created = await insertVocabularyListIgnoringConflict('Oxford 5000 A1');
      if (!created) throw new Error('expected list to be created');

      const found = await getVocabularyListByTitle('Oxford 5000 A1');

      expect(found?.id).toBe(created.id);
    });

    it('returns undefined when no list matches the title', async () => {
      const found = await getVocabularyListByTitle('Nonexistent List');

      expect(found).toBeUndefined();
    });
  });

  describe('getVocabularyListById', () => {
    it('returns the list matching the id', async () => {
      const created = await insertVocabularyListIgnoringConflict('Oxford 5000 A1');
      if (!created) throw new Error('expected list to be created');

      const found = await getVocabularyListById(created.id);

      expect(found?.title).toBe('Oxford 5000 A1');
    });

    it('returns undefined when no list matches the id', async () => {
      const found = await getVocabularyListById('00000000-0000-7000-8000-000000000000');

      expect(found).toBeUndefined();
    });
  });
});
