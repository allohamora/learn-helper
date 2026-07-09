import { eq } from 'drizzle-orm';
import { describe, expect, it } from 'vitest';
import { countItems } from '@/server/db/db.utils';
import { db } from '@/server/db/db.service';
import { LearningStatus, PartOfSpeech, user, userVocabularyItem } from '@/server/db/db.schema';
import { Exception } from '@/server/utils/exception.utils';
import { createMissingVocabularyItems } from '@/server/vocabulary/vocabulary-item.repository';
import { createVocabularyListItemsIfNotExist } from '@/server/vocabulary/vocabulary-list-item.repository';
import { findOrCreateVocabularyListByTitle } from '@/server/vocabulary/vocabulary-list.repository';
import { addVocabularyListToUser } from '@/server/vocabulary/vocabulary.service';

const createTestUser = async (id: string) => {
  const [row] = await db
    .insert(user)
    .values({ id, name: 'Test User', email: `${id}@example.com` })
    .returning();
  if (!row) throw new Error('expected user to be created');

  return row;
};

const createTestList = async (values: string[]) => {
  const list = await findOrCreateVocabularyListByTitle('Oxford 5000 A1');
  const items = await createMissingVocabularyItems(
    values.map((value) => ({
      value,
      definition: `definition of ${value}`,
      uaTranslation: value,
      partOfSpeech: PartOfSpeech.Verb,
      spelling: value,
    })),
  );

  await createVocabularyListItemsIfNotExist(
    items.map((item) => ({ vocabularyListId: list.id, vocabularyItemId: item.id })),
  );

  return { list, items };
};

describe('vocabularyService', () => {
  describe('addVocabularyListToUser', () => {
    it('creates a waiting progress row for every item in the list', async () => {
      const { id: userId } = await createTestUser('user-1');
      const { list, items } = await createTestList(['run', 'walk']);

      await addVocabularyListToUser(userId, list.id);

      expect(await countItems(userVocabularyItem)).toBe(items.length);

      const rows = await db.query.userVocabularyItem.findMany({ where: eq(userVocabularyItem.userId, userId) });
      expect(rows.every((row) => row.status === LearningStatus.Waiting)).toBe(true);
    });

    it('throws a conflict when the list was already added', async () => {
      const { id: userId } = await createTestUser('user-1');
      const { list, items } = await createTestList(['run', 'walk']);

      await addVocabularyListToUser(userId, list.id);

      await expect(addVocabularyListToUser(userId, list.id)).rejects.toThrow(Exception);
      expect(await countItems(userVocabularyItem)).toBe(items.length);
    });

    it('does not reset the status of a word already tracked from another list', async () => {
      const { id: userId } = await createTestUser('user-1');
      const { list, items } = await createTestList(['run', 'walk']);
      const [learnedItem] = items;
      if (!learnedItem) throw new Error('expected an item');

      await db
        .insert(userVocabularyItem)
        .values({ userId, vocabularyItemId: learnedItem.id, status: LearningStatus.Learned, encounterCount: 3 });

      await addVocabularyListToUser(userId, list.id);

      const row = await db.query.userVocabularyItem.findFirst({
        where: eq(userVocabularyItem.vocabularyItemId, learnedItem.id),
      });
      expect(row?.status).toBe(LearningStatus.Learned);
      expect(await countItems(userVocabularyItem)).toBe(items.length);
    });

    it('throws not found for a non-existent list', async () => {
      const { id: userId } = await createTestUser('user-1');

      await expect(addVocabularyListToUser(userId, '00000000-0000-0000-0000-000000000000')).rejects.toThrow(Exception);
    });
  });
});
