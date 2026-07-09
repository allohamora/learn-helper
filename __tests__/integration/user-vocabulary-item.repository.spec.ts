import { asc, eq, sql } from 'drizzle-orm';
import { describe, expect, it } from 'vitest';
import { countItems } from '@/server/db/db.utils';
import { db } from '@/server/db/db.service';
import { PartOfSpeech, user, userVocabularyItem, vocabularyItem } from '@/server/db/db.schema';
import { createMissingVocabularyItems } from '@/server/vocabulary/vocabulary-item.repository';
import { createVocabularyListItemsIfNotExist } from '@/server/vocabulary/vocabulary-list-item.repository';
import { findOrCreateVocabularyListByTitle } from '@/server/vocabulary/vocabulary-list.repository';
import { createUserVocabularyItemsFromList } from '@/server/vocabulary/user-vocabulary-item.repository';

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

    it('orders created rows by createdAt to match the order words were added to the list', async () => {
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

      // inserted one at a time so each vocabularyListItem gets its own createdAt, giving the list a well-defined order
      for (const word of words) {
        await createVocabularyListItemsIfNotExist([{ vocabularyListId: list.id, vocabularyItemId: word.id }]);
      }

      await createUserVocabularyItemsFromList(userId, list.id);

      const userWords = await db
        .select({
          value: vocabularyItem.value,
          createdAt: sql<number>`extract(epoch from ${userVocabularyItem.createdAt})`,
        })
        .from(userVocabularyItem)
        .innerJoin(vocabularyItem, eq(userVocabularyItem.vocabularyItemId, vocabularyItem.id))
        .where(eq(userVocabularyItem.userId, userId))
        .orderBy(asc(userVocabularyItem.createdAt));

      // asserted separately from order: tied createdAt values can still sort into the right order by coincidence
      // (e.g. matching physical insertion order), so distinctness must be checked explicitly, not inferred from order
      const createdAtValues = userWords.map((userWord) => Number(userWord.createdAt));
      expect(new Set(createdAtValues).size).toBe(createdAtValues.length);

      expect(userWords.map((userWord) => userWord.value)).toEqual(words.map((word) => word.value));
    });
  });
});
