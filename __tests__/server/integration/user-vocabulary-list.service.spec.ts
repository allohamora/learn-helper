import { eq } from 'drizzle-orm';
import { describe, expect, it } from 'vitest';
import { countItems } from '@/server/db/db.utils';
import { db } from '@/server/db/db.service';
import { user, userVocabularyItem, userVocabularyList } from '@/server/db/db.schema';
import { Exception } from '@/server/utils/exception.utils';
import { createMissingVocabularyItems } from '@/server/vocabulary/vocabulary-item.repository';
import {
  createVocabularyListItemsIfNotExist,
  getVocabularyListItem,
} from '@/server/vocabulary/vocabulary-list-item.repository';
import { findOrCreateVocabularyListByTitle } from '@/server/vocabulary/vocabulary-list.service';
import {
  addVocabularyItemToPersonalList,
  addVocabularyListToUser,
  createPersonalVocabularyListForUser,
  getUserVocabularyListOrThrow,
  getUserVocabularyListWithRelationsOrThrow,
} from '@/server/user-vocabulary/user-vocabulary-list.service';
import { getUserVocabularyListByVocabularyListId } from '@/server/user-vocabulary/user-vocabulary-list.repository';
import { LearningStatus, PartOfSpeech, VocabularyListType } from '@/const/vocabulary';

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

const getUserVocabularyListByVocabularyListIdOrThrow = async ({
  userId,
  vocabularyListId,
}: {
  userId: string;
  vocabularyListId: string;
}) => {
  const userVocabularyList = await getUserVocabularyListByVocabularyListId({ userId, vocabularyListId });
  if (!userVocabularyList) throw new Error('expected a user vocabulary list');

  return userVocabularyList;
};

describe('userVocabularyListService', () => {
  describe('addVocabularyListToUser', () => {
    it('creates a waiting progress row for every item in the list', async () => {
      const { id: userId } = await createTestUser('user-1');
      const { list, items } = await createTestList(['run', 'walk']);

      await addVocabularyListToUser({ userId, vocabularyListId: list.id });

      expect(await countItems(userVocabularyItem)).toBe(items.length);

      const rows = await db.query.userVocabularyItem.findMany({ where: eq(userVocabularyItem.userId, userId) });
      expect(rows.every((row) => row.status === LearningStatus.Waiting)).toBe(true);
    });

    it('throws a conflict when the list was already added', async () => {
      const { id: userId } = await createTestUser('user-1');
      const { list, items } = await createTestList(['run', 'walk']);

      await addVocabularyListToUser({ userId, vocabularyListId: list.id });

      await expect(addVocabularyListToUser({ userId, vocabularyListId: list.id })).rejects.toThrow(Exception);
      expect(await countItems(userVocabularyItem)).toBe(items.length);
    });

    it('does not reset the status of an item already tracked from another list', async () => {
      const { id: userId } = await createTestUser('user-1');
      const { list, items } = await createTestList(['run', 'walk']);
      const [learnedItem] = items;
      if (!learnedItem) throw new Error('expected an item');

      await db
        .insert(userVocabularyItem)
        .values({ userId, vocabularyItemId: learnedItem.id, status: LearningStatus.Learned, encounterCount: 3 });

      await addVocabularyListToUser({ userId, vocabularyListId: list.id });

      const row = await db.query.userVocabularyItem.findFirst({
        where: eq(userVocabularyItem.vocabularyItemId, learnedItem.id),
      });
      expect(row?.status).toBe(LearningStatus.Learned);
      expect(await countItems(userVocabularyItem)).toBe(items.length);
    });

    it('throws not found for a non-existent list', async () => {
      const { id: userId } = await createTestUser('user-1');

      await expect(
        addVocabularyListToUser({ userId, vocabularyListId: '00000000-0000-0000-0000-000000000000' }),
      ).rejects.toThrow(Exception);
    });
  });

  describe('addVocabularyItemToPersonalList', () => {
    it('links the word to the list and creates a waiting progress row', async () => {
      const { id: userId } = await createTestUser('user-1');
      const { items } = await createTestList(['run', 'walk']);
      const [item] = items;
      if (!item) throw new Error('expected an item');
      const personalList = await createPersonalVocabularyListForUser(userId);
      const userVocabularyList = await getUserVocabularyListByVocabularyListIdOrThrow({
        userId,
        vocabularyListId: personalList.id,
      });

      const userItem = await addVocabularyItemToPersonalList({
        userId,
        userVocabularyListId: userVocabularyList.id,
        vocabularyItemId: item.id,
      });

      expect(userItem).toMatchObject({
        vocabularyItemId: item.id,
        status: LearningStatus.Waiting,
        vocabularyItem: { id: item.id },
      });
      await expect(
        getVocabularyListItem({ vocabularyListId: personalList.id, vocabularyItemId: item.id }),
      ).resolves.toBeDefined();
    });

    it('throws a conflict when the word is already in the list', async () => {
      const { id: userId } = await createTestUser('user-1');
      const { items } = await createTestList(['run']);
      const [item] = items;
      if (!item) throw new Error('expected an item');
      const personalList = await createPersonalVocabularyListForUser(userId);
      const userVocabularyList = await getUserVocabularyListByVocabularyListIdOrThrow({
        userId,
        vocabularyListId: personalList.id,
      });

      await addVocabularyItemToPersonalList({
        userId,
        userVocabularyListId: userVocabularyList.id,
        vocabularyItemId: item.id,
      });

      await expect(
        addVocabularyItemToPersonalList({
          userId,
          userVocabularyListId: userVocabularyList.id,
          vocabularyItemId: item.id,
        }),
      ).rejects.toThrow(Exception);
    });

    it('throws forbidden when the list is not personal', async () => {
      const { id: userId } = await createTestUser('user-1');
      const { list, items } = await createTestList(['run']);
      const [item] = items;
      if (!item) throw new Error('expected an item');
      const userVocabularyList = await addVocabularyListToUser({ userId, vocabularyListId: list.id });

      await expect(
        addVocabularyItemToPersonalList({
          userId,
          userVocabularyListId: userVocabularyList.id,
          vocabularyItemId: item.id,
        }),
      ).rejects.toThrow(Exception);
    });

    it('throws forbidden when the list belongs to another user', async () => {
      const { id: userId } = await createTestUser('user-1');
      const { id: otherUserId } = await createTestUser('user-2');
      const { items } = await createTestList(['run']);
      const [item] = items;
      if (!item) throw new Error('expected an item');
      const otherPersonalList = await createPersonalVocabularyListForUser(otherUserId);
      const userVocabularyList = await addVocabularyListToUser({ userId, vocabularyListId: otherPersonalList.id });

      await expect(
        addVocabularyItemToPersonalList({
          userId,
          userVocabularyListId: userVocabularyList.id,
          vocabularyItemId: item.id,
        }),
      ).rejects.toThrow(Exception);
    });

    it('throws not found for a non-existent list', async () => {
      const { id: userId } = await createTestUser('user-1');
      const { items } = await createTestList(['run']);
      const [item] = items;
      if (!item) throw new Error('expected an item');

      await expect(
        addVocabularyItemToPersonalList({
          userId,
          userVocabularyListId: '00000000-0000-0000-0000-000000000000',
          vocabularyItemId: item.id,
        }),
      ).rejects.toThrow(Exception);
    });

    it('throws not found for a non-existent item', async () => {
      const { id: userId } = await createTestUser('user-1');
      const personalList = await createPersonalVocabularyListForUser(userId);
      const userVocabularyList = await getUserVocabularyListByVocabularyListIdOrThrow({
        userId,
        vocabularyListId: personalList.id,
      });

      await expect(
        addVocabularyItemToPersonalList({
          userId,
          userVocabularyListId: userVocabularyList.id,
          vocabularyItemId: '00000000-0000-0000-0000-000000000000',
        }),
      ).rejects.toThrow(Exception);
    });

    it('does not reset the status of an item already tracked from another list', async () => {
      const { id: userId } = await createTestUser('user-1');
      const { items } = await createTestList(['run']);
      const [item] = items;
      if (!item) throw new Error('expected an item');
      await db
        .insert(userVocabularyItem)
        .values({ userId, vocabularyItemId: item.id, status: LearningStatus.Learned, encounterCount: 3 });
      const personalList = await createPersonalVocabularyListForUser(userId);
      const userVocabularyList = await getUserVocabularyListByVocabularyListIdOrThrow({
        userId,
        vocabularyListId: personalList.id,
      });

      const userItem = await addVocabularyItemToPersonalList({
        userId,
        userVocabularyListId: userVocabularyList.id,
        vocabularyItemId: item.id,
      });

      expect(userItem.status).toBe(LearningStatus.Learned);
      expect(await countItems(userVocabularyItem)).toBe(1);
    });
  });

  describe('createPersonalVocabularyListForUser', () => {
    it('creates a personal list and enrolls the user in it', async () => {
      const { id: userId } = await createTestUser('user-1');

      const list = await createPersonalVocabularyListForUser(userId);

      expect(list).toMatchObject({ ownerId: userId, type: VocabularyListType.Personal, title: null });
      await expect(
        getUserVocabularyListByVocabularyListId({ userId, vocabularyListId: list.id }),
      ).resolves.toMatchObject({ vocabularyListId: list.id });
    });

    it('is idempotent - a second call returns the same list without duplicating the enrollment', async () => {
      const { id: userId } = await createTestUser('user-1');

      const first = await createPersonalVocabularyListForUser(userId);
      const second = await createPersonalVocabularyListForUser(userId);

      expect(second.id).toBe(first.id);
      const enrollments = await db.query.userVocabularyList.findMany({
        where: eq(userVocabularyList.vocabularyListId, first.id),
      });
      expect(enrollments).toHaveLength(1);
    });

    it('returns the same list for concurrent calls once it already exists', async () => {
      const { id: userId } = await createTestUser('user-1');
      const created = await createPersonalVocabularyListForUser(userId);

      // the list already exists before any of these start, so every call takes the "existing"
      // branch - none of them race on the INSERT, so none of them can fail
      const results = await Promise.all(Array.from({ length: 5 }, () => createPersonalVocabularyListForUser(userId)));

      expect(results.every((list) => list.id === created.id)).toBe(true);
      const lists = await db.query.vocabularyList.findMany({
        where: (list, { eq }) => eq(list.ownerId, userId),
      });
      expect(lists).toHaveLength(1);
    });

    it('never creates more than one personal list per user, even when concurrent calls race to create it for a brand-new user', async () => {
      const { id: userId } = await createTestUser('user-1');

      // with no pre-existing row, this would otherwise be a genuine race between the SELECT and
      // the INSERT (verified empirically without the user-row lock: real runs split anywhere from
      // 1 to 4 successes out of 5, with the rest throwing real unique-violation errors). The
      // FOR UPDATE lock on the user's own row in createPersonalVocabularyListForUser serializes
      // these instead of letting them race, so none of the 5 should ever fail
      const results = await Promise.all(Array.from({ length: 5 }, () => createPersonalVocabularyListForUser(userId)));

      const listIds = new Set(results.map((list) => list.id));
      expect(listIds.size).toBe(1);

      const lists = await db.query.vocabularyList.findMany({
        where: (list, { eq }) => eq(list.ownerId, userId),
      });
      expect(lists).toHaveLength(1);

      const enrollments = await db.query.userVocabularyList.findMany({
        where: eq(userVocabularyList.vocabularyListId, lists[0]!.id),
      });
      expect(enrollments).toHaveLength(1);
    });

    it('throws not found for a non-existent user', async () => {
      await expect(createPersonalVocabularyListForUser('00000000-0000-0000-0000-000000000000')).rejects.toThrow(
        Exception,
      );
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

    it('throws not found when the enrollment belongs to a different user', async () => {
      const { id: userId } = await createTestUser('user-1');
      const { id: otherUserId } = await createTestUser('user-2');
      const { list } = await createTestList(['run']);
      const otherUserList = await addVocabularyListToUser({ userId: otherUserId, vocabularyListId: list.id });

      await expect(getUserVocabularyListOrThrow({ userId, userVocabularyListId: otherUserList.id })).rejects.toThrow(
        Exception,
      );
    });
  });

  describe('getUserVocabularyListWithRelationsOrThrow', () => {
    it('resolves with the enrollment and the vocabulary list it points to', async () => {
      const { id: userId } = await createTestUser('user-1');
      const { list } = await createTestList(['run']);

      const userList = await addVocabularyListToUser({ userId, vocabularyListId: list.id });

      await expect(
        getUserVocabularyListWithRelationsOrThrow({ userId, userVocabularyListId: userList.id }),
      ).resolves.toMatchObject({
        vocabularyListId: list.id,
        vocabularyList: { id: list.id, title: 'Oxford 5000 A1' },
      });
    });

    it('throws not found for a non-existent list', async () => {
      const { id: userId } = await createTestUser('user-1');

      await expect(
        getUserVocabularyListWithRelationsOrThrow({
          userId,
          userVocabularyListId: '00000000-0000-0000-0000-000000000000',
        }),
      ).rejects.toThrow(Exception);
    });

    it('throws not found when the enrollment belongs to a different user', async () => {
      const { id: userId } = await createTestUser('user-1');
      const { id: otherUserId } = await createTestUser('user-2');
      const { list } = await createTestList(['run']);
      const otherUserList = await addVocabularyListToUser({ userId: otherUserId, vocabularyListId: list.id });

      await expect(
        getUserVocabularyListWithRelationsOrThrow({ userId, userVocabularyListId: otherUserList.id }),
      ).rejects.toThrow(Exception);
    });
  });
});
