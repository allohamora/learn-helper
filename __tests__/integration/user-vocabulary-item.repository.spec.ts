import { asc, eq } from 'drizzle-orm';
import { describe, expect, it } from 'vitest';
import { countItems } from '@/server/db/db.utils';
import { db } from '@/server/db/db.service';
import { user, userVocabularyItem, vocabularyItem } from '@/server/db/db.schema';
import { createMissingVocabularyItems } from '@/server/vocabulary/vocabulary-item.repository';
import { createVocabularyListItemsIfNotExist } from '@/server/vocabulary/vocabulary-list-item.repository';
import { findOrCreateVocabularyListByTitle } from '@/server/vocabulary/vocabulary-list.repository';
import { createUserVocabularyItemsFromList } from '@/server/vocabulary/user-vocabulary-item.repository';
import { PartOfSpeech } from '@/const/vocabulary';

describe('userVocabularyItemRepository', () => {
  describe('createUserVocabularyItemsFromList', () => {
    it('creates progress rows for every item in the list without creating duplicates on re-run', async () => {
      const [{ id: userId }] = await db
        .insert(user)
        .values({ id: 'user-1', name: 'Test User', email: 'test-user-1@example.com' })
        .returning();
      if (!userId) throw new Error('expected user to be created');

      const list = await findOrCreateVocabularyListByTitle('Oxford 5000 A1');
      const items = await createMissingVocabularyItems([
        {
          value: 'run',
          definition: 'to move fast on foot',
          uaTranslation: 'бігти',
          partOfSpeech: PartOfSpeech.Verb,
          spelling: '/rʌn/',
        },
      ]);
      await createVocabularyListItemsIfNotExist(
        items.map((item) => ({ vocabularyListId: list.id, vocabularyItemId: item.id })),
      );

      await createUserVocabularyItemsFromList(userId, list.id);
      await createUserVocabularyItemsFromList(userId, list.id);

      expect(await countItems(userVocabularyItem)).toBe(items.length);
    });

    it('orders created rows by id to match the order words were added to the list', async () => {
      const [{ id: userId }] = await db
        .insert(user)
        .values({ id: 'user-2', name: 'Test User 2', email: 'test-user-2@example.com' })
        .returning();
      if (!userId) throw new Error('expected user to be created');

      const list = await findOrCreateVocabularyListByTitle('Oxford 5000 A2');
      const words = await createMissingVocabularyItems(
        Array.from({ length: 10 }, (_, i) => ({
          value: `word-${i}`,
          definition: `definition ${i}`,
          uaTranslation: `переклад ${i}`,
          partOfSpeech: PartOfSpeech.Noun,
          spelling: `/word-${i}/`,
        })),
      );

      await createVocabularyListItemsIfNotExist(
        words.map((word) => ({ vocabularyListId: list.id, vocabularyItemId: word.id })),
      );

      await createUserVocabularyItemsFromList(userId, list.id);

      const userWords = await db
        .select({
          id: userVocabularyItem.id,
          value: vocabularyItem.value,
        })
        .from(userVocabularyItem)
        .innerJoin(vocabularyItem, eq(userVocabularyItem.vocabularyItemId, vocabularyItem.id))
        .where(eq(userVocabularyItem.userId, userId))
        .orderBy(asc(userVocabularyItem.id));

      const idValues = userWords.map((userWord) => userWord.id);
      expect(new Set(idValues).size).toBe(idValues.length);

      expect(userWords.map((userWord) => userWord.value)).toEqual(words.map((word) => word.value));
    });
  });
});
