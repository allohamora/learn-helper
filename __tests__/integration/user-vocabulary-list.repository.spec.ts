import { describe, expect, it } from 'vitest';
import { user, vocabularyList } from '@/server/db/db.schema';
import { db } from '@/server/db/db.service';
import { Exception } from '@/server/utils/exception.utils';
import { createMissingVocabularyItems } from '@/server/vocabulary/vocabulary-item.repository';
import { createVocabularyListItemsIfNotExist } from '@/server/vocabulary/vocabulary-list-item.repository';
import { findOrCreateVocabularyListByTitle } from '@/server/vocabulary/vocabulary-list.repository';
import { addVocabularyListToUser } from '@/server/user-vocabulary/user-vocabulary-list.service';
import {
  getUserAvailableVocabularyLists,
  getUserVocabularyListOrThrow,
} from '@/server/user-vocabulary/user-vocabulary-list.repository';
import { PartOfSpeech } from '@/const/vocabulary';

const createTestUser = async (id: string) => {
  const [row] = await db
    .insert(user)
    .values({ id, name: 'Test User', email: `${id}@example.com` })
    .returning();
  if (!row) throw new Error('expected user to be created');

  return row;
};

const createVocabularyList = async (title: string, createdAt: Date) => {
  const [row] = await db.insert(vocabularyList).values({ title, createdAt }).returning();
  if (!row) throw new Error('expected vocabulary list to be created');

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

describe('userVocabularyListRepository', () => {
  describe('getUserAvailableVocabularyLists', () => {
    it('returns a list with a null addedAt when the user has not added it', async () => {
      const { id: userId } = await createTestUser('user-1');
      await findOrCreateVocabularyListByTitle('Oxford 5000 A1');

      const lists = await getUserAvailableVocabularyLists(userId);

      expect(lists).toMatchObject([{ title: 'Oxford 5000 A1', addedAt: null }]);
    });

    it('marks an enrolled list as added and sorts it first', async () => {
      const { id: userId } = await createTestUser('user-1');
      const list = await findOrCreateVocabularyListByTitle('Oxford 5000 A1');
      await findOrCreateVocabularyListByTitle('Oxford 5000 A2');

      await addVocabularyListToUser({ userId, vocabularyListId: list.id });

      const lists = await getUserAvailableVocabularyLists(userId);

      expect(lists).toMatchObject([
        { title: 'Oxford 5000 A1', addedAt: expect.any(Date) },
        { title: 'Oxford 5000 A2', addedAt: null },
      ]);
    });

    it('sorts by enrollment first and then by vocabulary list creation date', async () => {
      const { id: userId } = await createTestUser('user-1');
      const unaddedOld = await createVocabularyList('Unadded Old', new Date('2024-01-01T00:00:00Z'));
      const addedNew = await createVocabularyList('Added New', new Date('2024-01-04T00:00:00Z'));
      const addedOld = await createVocabularyList('Added Old', new Date('2024-01-02T00:00:00Z'));
      const unaddedNew = await createVocabularyList('Unadded New', new Date('2024-01-03T00:00:00Z'));

      await addVocabularyListToUser({ userId, vocabularyListId: addedNew.id });
      await addVocabularyListToUser({ userId, vocabularyListId: addedOld.id });

      const lists = await getUserAvailableVocabularyLists(userId);

      expect(lists.map((list) => list.vocabularyListId)).toEqual([
        addedOld.id,
        addedNew.id,
        unaddedOld.id,
        unaddedNew.id,
      ]);
    });
  });

  describe('getUserVocabularyListOrThrow', () => {
    it('resolves with the list when the user has added it', async () => {
      const { id: userId } = await createTestUser('user-1');
      const { list } = await createTestList(['run']);

      const userList = await addVocabularyListToUser({ userId, vocabularyListId: list.id });

      await expect(getUserVocabularyListOrThrow({ userId, userVocabularyListId: userList.id })).resolves.toMatchObject({
        vocabularyListId: list.id,
      });
    });

    it('throws not found for a non-existent list', async () => {
      const { id: userId } = await createTestUser('user-1');

      await expect(
        getUserVocabularyListOrThrow({ userId, userVocabularyListId: '00000000-0000-0000-0000-000000000000' }),
      ).rejects.toThrow(Exception);
    });

    it('throws not found when the list exists but the user has not added it', async () => {
      const { id: userId } = await createTestUser('user-1');
      const { list } = await createTestList(['run']);

      await expect(getUserVocabularyListOrThrow({ userId, userVocabularyListId: list.id })).rejects.toThrow(Exception);
    });
  });
});
