import { describe, expect, it } from 'vitest';
import { user, vocabularyList } from '@/server/db/db.schema';
import { db } from '@/server/db/db.service';
import { findOrCreateVocabularyListByTitle } from '@/server/vocabulary/vocabulary-list.service';
import {
  addVocabularyListToUser,
  createPersonalVocabularyListForUser,
} from '@/server/user-vocabulary/user-vocabulary-list.service';
import {
  getUserAvailableVocabularyLists,
  getUserVocabularyListById,
  getUserVocabularyListByVocabularyListId,
  getUserVocabularyListWithRelations,
} from '@/server/user-vocabulary/user-vocabulary-list.repository';

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

describe('userVocabularyListRepository', () => {
  describe('getUserAvailableVocabularyLists', () => {
    it('returns a list with a null userVocabularyList when the user has not added it', async () => {
      const { id: userId } = await createTestUser('user-1');
      await findOrCreateVocabularyListByTitle('Oxford 5000 A1');

      const lists = await getUserAvailableVocabularyLists(userId);

      expect(lists).toMatchObject([{ title: 'Oxford 5000 A1', userVocabularyList: null }]);
    });

    it('marks an enrolled list as added and sorts it first', async () => {
      const { id: userId } = await createTestUser('user-1');
      const list = await findOrCreateVocabularyListByTitle('Oxford 5000 A1');
      await findOrCreateVocabularyListByTitle('Oxford 5000 A2');

      await addVocabularyListToUser({ userId, vocabularyListId: list.id });

      const lists = await getUserAvailableVocabularyLists(userId);

      expect(lists).toMatchObject([
        {
          id: list.id,
          title: 'Oxford 5000 A1',
          userVocabularyList: {
            vocabularyListId: list.id,
            createdAt: expect.any(Date),
          },
        },
        { title: 'Oxford 5000 A2', userVocabularyList: null },
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

      expect(lists.map((list) => list.id)).toEqual([addedOld.id, addedNew.id, unaddedOld.id, unaddedNew.id]);
    });

    it("sorts the user's personal list first, ahead of an older enrolled public list", async () => {
      const { id: userId } = await createTestUser('user-1');
      const publicList = await createVocabularyList('Oxford 5000 A1', new Date('2020-01-01T00:00:00Z'));
      await addVocabularyListToUser({ userId, vocabularyListId: publicList.id });
      const personalList = await createPersonalVocabularyListForUser(userId);

      const lists = await getUserAvailableVocabularyLists(userId);

      expect(lists.map((list) => list.id)).toEqual([personalList.id, publicList.id]);
    });

    it("never returns another user's personal list", async () => {
      const { id: userId } = await createTestUser('user-1');
      const { id: otherUserId } = await createTestUser('user-2');
      await createPersonalVocabularyListForUser(otherUserId);

      const lists = await getUserAvailableVocabularyLists(userId);

      expect(lists).toEqual([]);
    });
  });

  describe('getUserVocabularyListByVocabularyListId', () => {
    it('resolves when the user has added the list', async () => {
      const { id: userId } = await createTestUser('user-1');
      const list = await findOrCreateVocabularyListByTitle('Oxford 5000 A1');
      const userList = await addVocabularyListToUser({ userId, vocabularyListId: list.id });

      await expect(
        getUserVocabularyListByVocabularyListId({ userId, vocabularyListId: list.id }),
      ).resolves.toMatchObject({ id: userList.id });
    });

    it('resolves with undefined when the user has not added the list', async () => {
      const { id: userId } = await createTestUser('user-1');
      const list = await findOrCreateVocabularyListByTitle('Oxford 5000 A1');

      await expect(
        getUserVocabularyListByVocabularyListId({ userId, vocabularyListId: list.id }),
      ).resolves.toBeUndefined();
    });
  });

  describe('getUserVocabularyListById', () => {
    it('resolves when the list belongs to the user', async () => {
      const { id: userId } = await createTestUser('user-1');
      const list = await findOrCreateVocabularyListByTitle('Oxford 5000 A1');
      const userList = await addVocabularyListToUser({ userId, vocabularyListId: list.id });

      await expect(getUserVocabularyListById({ userId, userVocabularyListId: userList.id })).resolves.toMatchObject({
        vocabularyListId: list.id,
      });
    });

    it('resolves with undefined when the list belongs to a different user', async () => {
      const { id: userId } = await createTestUser('user-1');
      const { id: otherUserId } = await createTestUser('user-2');
      const list = await findOrCreateVocabularyListByTitle('Oxford 5000 A1');
      const userList = await addVocabularyListToUser({ userId, vocabularyListId: list.id });

      await expect(
        getUserVocabularyListById({ userId: otherUserId, userVocabularyListId: userList.id }),
      ).resolves.toBeUndefined();
    });
  });

  describe('getUserVocabularyListWithRelations', () => {
    it('resolves with the enrollment and the vocabulary list it points to', async () => {
      const { id: userId } = await createTestUser('user-1');
      const list = await findOrCreateVocabularyListByTitle('Oxford 5000 A1');
      const userList = await addVocabularyListToUser({ userId, vocabularyListId: list.id });

      await expect(
        getUserVocabularyListWithRelations({ userId, userVocabularyListId: userList.id }),
      ).resolves.toMatchObject({
        vocabularyListId: list.id,
        vocabularyList: { id: list.id, title: 'Oxford 5000 A1' },
      });
    });

    it('resolves with undefined when the list does not belong to the user', async () => {
      const { id: userId } = await createTestUser('user-1');
      const { id: otherUserId } = await createTestUser('user-2');
      const list = await findOrCreateVocabularyListByTitle('Oxford 5000 A1');
      const otherUserList = await addVocabularyListToUser({ userId: otherUserId, vocabularyListId: list.id });

      await expect(
        getUserVocabularyListWithRelations({ userId, userVocabularyListId: otherUserList.id }),
      ).resolves.toBeUndefined();
    });
  });
});
