import { and, asc, eq } from 'drizzle-orm';
import { describe, expect, it } from 'vitest';
import { countItems } from '@/server/db/db.utils';
import { db } from '@/server/db/db.service';
import { user, userVocabularyItem, vocabularyItem } from '@/server/db/db.schema';
import { createMissingVocabularyItems } from '@/server/vocabulary/vocabulary-item.repository';
import { createVocabularyListItemsIfNotExist } from '@/server/vocabulary/vocabulary-list-item.repository';
import { findOrCreateVocabularyListByTitle } from '@/server/vocabulary/vocabulary-list.service';
import {
  createUserVocabularyItemsFromList,
  getNewItems,
  getReviewItems,
  getUserVocabularyListItemLink,
  getUserVocabularyListItems,
  getUserVocabularyListItemStatusCounts,
  updateUserVocabularyItemStatus,
} from '@/server/user-vocabulary/user-vocabulary-item.repository';
import { createUserVocabularyList } from '@/server/user-vocabulary/user-vocabulary-list.repository';
import { RequestType } from '@/const/request';
import { LearningStatus, PartOfSpeech } from '@/const/vocabulary';

const USER_ID = 'learning-items-user';
const BASE_TIME = new Date('2026-01-01T00:00:00Z').getTime();

type SeedValue = {
  value: string;
  encounterCount: number;
  offsetSeconds: number;
  status?: LearningStatus;
};

const seedLearningItems = async ({
  userId = USER_ID,
  values,
  listTitle = 'Oxford 5000 A1',
}: {
  userId?: string;
  values: SeedValue[];
  listTitle?: string;
}) => {
  await db
    .insert(user)
    .values({ id: userId, name: `Test User ${userId}`, email: `${userId}@example.com` })
    .onConflictDoNothing();

  const list = await findOrCreateVocabularyListByTitle(listTitle);
  const items = await createMissingVocabularyItems(
    values.map(({ value }) => ({
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
  await createUserVocabularyItemsFromList({ userId, vocabularyListId: list.id });

  for (const { value, encounterCount, offsetSeconds, status = LearningStatus.Learning } of values) {
    const item = items.find((i) => i.value === value);
    if (!item) throw new Error(`expected item ${value} to be created`);

    await db
      .update(userVocabularyItem)
      .set({ status, encounterCount, enqueuedAt: new Date(BASE_TIME + offsetSeconds * 1000) })
      .where(and(eq(userVocabularyItem.userId, userId), eq(userVocabularyItem.vocabularyItemId, item.id)));
  }

  return { list, items };
};

const seedUserItem = async ({
  userSuffix,
  value = 'run',
  listTitle = 'Oxford 5000 A1',
  enrollInList = true,
}: {
  userSuffix: string;
  value?: string;
  listTitle?: string;
  enrollInList?: boolean;
}) => {
  const userId = `user-${userSuffix}`;
  await db.insert(user).values({ id: userId, name: `Test User ${userSuffix}`, email: `${userId}@example.com` });

  const list = await findOrCreateVocabularyListByTitle(listTitle);
  const [item] = await createMissingVocabularyItems([
    {
      value,
      definition: `definition of ${value}`,
      uaTranslation: value,
      partOfSpeech: PartOfSpeech.Verb,
      spelling: value,
    },
  ]);
  if (!item) throw new Error('expected item to be created');

  await createVocabularyListItemsIfNotExist([{ vocabularyListId: list.id, vocabularyItemId: item.id }]);
  await createUserVocabularyItemsFromList({ userId, vocabularyListId: list.id });

  const userList = enrollInList ? await createUserVocabularyList({ userId, vocabularyListId: list.id }) : undefined;

  const userItem = await db.query.userVocabularyItem.findFirst({
    where: eq(userVocabularyItem.userId, userId),
  });
  if (!userItem) throw new Error('expected user item to be created');

  return { userId, list, item, userItem, userList };
};

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

      await createUserVocabularyItemsFromList({ userId, vocabularyListId: list.id });
      await createUserVocabularyItemsFromList({ userId, vocabularyListId: list.id });

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

      await createUserVocabularyItemsFromList({ userId, vocabularyListId: list.id });

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

  describe('getUserVocabularyListItemLink', () => {
    it('resolves when the list and item belong to the user and the item is linked to the list', async () => {
      const { userId, item, userItem, userList } = await seedUserItem({ userSuffix: 'linked' });
      if (!userList) throw new Error('expected user list to be created');

      await expect(
        getUserVocabularyListItemLink({
          userId,
          userVocabularyListId: userList.id,
          userVocabularyItemId: userItem.id,
        }),
      ).resolves.toEqual({
        userVocabularyListId: userList.id,
        userVocabularyItemId: userItem.id,
        vocabularyItemId: item.id,
      });
    });

    it('resolves with undefined when the list does not belong to the user', async () => {
      const { userId, userItem } = await seedUserItem({ userSuffix: 'no-list', enrollInList: false });

      await expect(
        getUserVocabularyListItemLink({
          userId,
          userVocabularyListId: '00000000-0000-7000-8000-000000000000',
          userVocabularyItemId: userItem.id,
        }),
      ).resolves.toBeUndefined();
    });

    it('resolves with undefined when the item does not belong to the user', async () => {
      const { userItem } = await seedUserItem({ userSuffix: 'wrong-item-owner' });
      const { userId: otherUserId, userList: otherUserList } = await seedUserItem({
        userSuffix: 'other-owner',
        value: 'walk',
      });
      if (!otherUserList) throw new Error('expected user list to be created');

      await expect(
        getUserVocabularyListItemLink({
          userId: otherUserId,
          userVocabularyListId: otherUserList.id,
          userVocabularyItemId: userItem.id,
        }),
      ).resolves.toBeUndefined();
    });

    it('resolves with undefined when the item is not linked to the given list', async () => {
      const userId = 'user-cross-list';
      await db.insert(user).values({ id: userId, name: 'Test User', email: `${userId}@example.com` });

      const runList = await findOrCreateVocabularyListByTitle('Oxford 5000 A1');
      const [runItem] = await createMissingVocabularyItems([
        { value: 'run', definition: 'run', uaTranslation: 'бігти', partOfSpeech: PartOfSpeech.Verb, spelling: 'run' },
      ]);
      if (!runItem) throw new Error('expected item to be created');
      await createVocabularyListItemsIfNotExist([{ vocabularyListId: runList.id, vocabularyItemId: runItem.id }]);
      const runUserList = await createUserVocabularyList({ userId, vocabularyListId: runList.id });
      if (!runUserList) throw new Error('expected user list to be created');
      await createUserVocabularyItemsFromList({ userId, vocabularyListId: runList.id });

      const walkList = await findOrCreateVocabularyListByTitle('Oxford 5000 A2');
      const [walkItem] = await createMissingVocabularyItems([
        {
          value: 'walk',
          definition: 'walk',
          uaTranslation: 'ходити',
          partOfSpeech: PartOfSpeech.Verb,
          spelling: 'walk',
        },
      ]);
      if (!walkItem) throw new Error('expected item to be created');
      await createVocabularyListItemsIfNotExist([{ vocabularyListId: walkList.id, vocabularyItemId: walkItem.id }]);
      await createUserVocabularyItemsFromList({ userId, vocabularyListId: walkList.id });

      const walkUserItem = await db.query.userVocabularyItem.findFirst({
        where: eq(userVocabularyItem.vocabularyItemId, walkItem.id),
      });
      if (!walkUserItem) throw new Error('expected user item to be created');

      await expect(
        getUserVocabularyListItemLink({
          userId,
          userVocabularyListId: runUserList.id,
          userVocabularyItemId: walkUserItem.id,
        }),
      ).resolves.toBeUndefined();
    });
  });

  describe('updateUserVocabularyItemStatus', () => {
    it("updates the item's status for the owning user", async () => {
      const { userId, userItem } = await seedUserItem({ userSuffix: 'update-status' });

      await updateUserVocabularyItemStatus({ userId, userVocabularyItemId: userItem.id, status: LearningStatus.Known });

      const updated = await db.query.userVocabularyItem.findFirst({ where: eq(userVocabularyItem.id, userItem.id) });
      expect(updated?.status).toBe(LearningStatus.Known);
    });

    it('does not update the status when the item belongs to a different user', async () => {
      const { userItem } = await seedUserItem({ userSuffix: 'not-owner' });

      await updateUserVocabularyItemStatus({
        userId: 'someone-else',
        userVocabularyItemId: userItem.id,
        status: LearningStatus.Known,
      });

      const unchanged = await db.query.userVocabularyItem.findFirst({ where: eq(userVocabularyItem.id, userItem.id) });
      expect(unchanged?.status).toBe(LearningStatus.Waiting);
    });
  });

  describe('getNewItems', () => {
    it('returns only Learning-status items with encounterCount 0, ordered by enqueuedAt ascending', async () => {
      const { list } = await seedLearningItems({
        values: [
          { value: 'banana', encounterCount: 0, offsetSeconds: 1 },
          { value: 'apple', encounterCount: 0, offsetSeconds: 0 },
          { value: 'date', encounterCount: 1, offsetSeconds: 0 },
          { value: 'cherry', encounterCount: 0, offsetSeconds: 2, status: LearningStatus.Waiting },
        ],
      });

      const items = await getNewItems({ userId: USER_ID, vocabularyListId: list.id, limit: 10 });

      expect(items.map((item) => item.vocabularyItem.value)).toEqual(['apple', 'banana']);
    });

    it('respects the limit', async () => {
      const { list } = await seedLearningItems({
        values: [
          { value: 'kiwi', encounterCount: 0, offsetSeconds: 0 },
          { value: 'lemon', encounterCount: 0, offsetSeconds: 1 },
          { value: 'mango', encounterCount: 0, offsetSeconds: 2 },
        ],
      });

      const items = await getNewItems({ userId: USER_ID, vocabularyListId: list.id, limit: 2 });

      expect(items.map((item) => item.vocabularyItem.value)).toEqual(['kiwi', 'lemon']);
    });

    it('scopes items to the given list and user', async () => {
      const { list: listA } = await seedLearningItems({
        values: [{ value: 'swim', encounterCount: 0, offsetSeconds: 0 }],
        listTitle: 'Oxford 5000 A1',
      });
      await seedLearningItems({
        values: [{ value: 'fly', encounterCount: 0, offsetSeconds: 0 }],
        listTitle: 'Oxford 5000 A2',
      });
      await seedLearningItems({
        userId: 'other-learning-items-user',
        values: [{ value: 'read', encounterCount: 0, offsetSeconds: 0 }],
        listTitle: 'Oxford 5000 A1',
      });

      const items = await getNewItems({ userId: USER_ID, vocabularyListId: listA.id, limit: 10 });

      expect(items.map((item) => item.vocabularyItem.value)).toEqual(['swim']);
    });

    it('returns an empty array when the user has no matching items in the list', async () => {
      const list = await findOrCreateVocabularyListByTitle('Oxford 5000 A1');

      const items = await getNewItems({ userId: USER_ID, vocabularyListId: list.id, limit: 10 });

      expect(items).toEqual([]);
    });
  });

  describe('getReviewItems', () => {
    it('returns only Learning-status items with encounterCount >= 1, ordered by enqueuedAt ascending', async () => {
      const { list } = await seedLearningItems({
        values: [
          { value: 'grape', encounterCount: 3, offsetSeconds: 1 },
          { value: 'fig', encounterCount: 1, offsetSeconds: 0 },
          { value: 'honeydew', encounterCount: 0, offsetSeconds: 0 },
          { value: 'elderberry', encounterCount: 2, offsetSeconds: 2, status: LearningStatus.Learned },
        ],
      });

      const items = await getReviewItems({ userId: USER_ID, vocabularyListId: list.id, limit: 10 });

      expect(items.map((item) => item.vocabularyItem.value)).toEqual(['fig', 'grape']);
    });

    it('respects the limit', async () => {
      const { list } = await seedLearningItems({
        values: [
          { value: 'lemon', encounterCount: 1, offsetSeconds: 0 },
          { value: 'mango', encounterCount: 1, offsetSeconds: 1 },
          { value: 'nectarine', encounterCount: 1, offsetSeconds: 2 },
        ],
      });

      const items = await getReviewItems({ userId: USER_ID, vocabularyListId: list.id, limit: 2 });

      expect(items.map((item) => item.vocabularyItem.value)).toEqual(['lemon', 'mango']);
    });

    it('scopes items to the given list and user', async () => {
      const { list: listA } = await seedLearningItems({
        values: [{ value: 'swim', encounterCount: 1, offsetSeconds: 0 }],
        listTitle: 'Oxford 5000 A1',
      });
      await seedLearningItems({
        values: [{ value: 'fly', encounterCount: 1, offsetSeconds: 0 }],
        listTitle: 'Oxford 5000 A2',
      });
      await seedLearningItems({
        userId: 'other-learning-items-user',
        values: [{ value: 'read', encounterCount: 1, offsetSeconds: 0 }],
        listTitle: 'Oxford 5000 A1',
      });

      const items = await getReviewItems({ userId: USER_ID, vocabularyListId: listA.id, limit: 10 });

      expect(items.map((item) => item.vocabularyItem.value)).toEqual(['swim']);
    });

    it('returns an empty array when the user has no matching items in the list', async () => {
      const list = await findOrCreateVocabularyListByTitle('Oxford 5000 A1');

      const items = await getReviewItems({ userId: USER_ID, vocabularyListId: list.id, limit: 10 });

      expect(items).toEqual([]);
    });
  });

  describe('getUserVocabularyListItems', () => {
    it("returns the user's items for the list with a total count", async () => {
      const { list } = await seedLearningItems({
        values: [
          { value: 'apple', encounterCount: 0, offsetSeconds: 0 },
          { value: 'banana', encounterCount: 1, offsetSeconds: 1, status: LearningStatus.Known },
        ],
      });

      const result = await getUserVocabularyListItems({ userId: USER_ID, vocabularyListId: list.id });

      expect(result.total).toBe(2);
      expect(result.items.map((item) => item.value).sort()).toEqual(['apple', 'banana']);
      expect(result.nextCursor).toBeUndefined();
    });

    it('filters by status', async () => {
      const { list } = await seedLearningItems({
        values: [
          { value: 'apple', encounterCount: 0, offsetSeconds: 0, status: LearningStatus.Learning },
          { value: 'banana', encounterCount: 1, offsetSeconds: 1, status: LearningStatus.Known },
        ],
      });

      const result = await getUserVocabularyListItems({
        userId: USER_ID,
        vocabularyListId: list.id,
        status: LearningStatus.Known,
      });

      expect(result.items.map((item) => item.value)).toEqual(['banana']);
      expect(result.total).toBe(1);
    });

    it('filters by a case-insensitive partial search on the word value', async () => {
      const { list } = await seedLearningItems({
        values: [
          { value: 'apple', encounterCount: 0, offsetSeconds: 0 },
          { value: 'banana', encounterCount: 0, offsetSeconds: 1 },
        ],
      });

      const result = await getUserVocabularyListItems({ userId: USER_ID, vocabularyListId: list.id, search: 'PPL' });

      expect(result.items.map((item) => item.value)).toEqual(['apple']);
    });

    it('paginates with a cursor and returns nextCursor when more items remain', async () => {
      const { list } = await seedLearningItems({
        values: [
          { value: 'apple', encounterCount: 0, offsetSeconds: 0 },
          { value: 'banana', encounterCount: 0, offsetSeconds: 1 },
          { value: 'cherry', encounterCount: 0, offsetSeconds: 2 },
        ],
      });

      const firstPage = await getUserVocabularyListItems({ userId: USER_ID, vocabularyListId: list.id, limit: 2 });
      expect(firstPage.items.map((item) => item.value)).toEqual(['apple', 'banana']);
      expect(firstPage.nextCursor).toBeDefined();

      const secondPage = await getUserVocabularyListItems({
        userId: USER_ID,
        vocabularyListId: list.id,
        limit: 2,
        cursor: firstPage.nextCursor,
      });
      expect(secondPage.items.map((item) => item.value)).toEqual(['cherry']);
      expect(secondPage.nextCursor).toBeUndefined();
    });

    it('skips the total count query and returns total: 0 when type is Data', async () => {
      const { list } = await seedLearningItems({ values: [{ value: 'apple', encounterCount: 0, offsetSeconds: 0 }] });

      const result = await getUserVocabularyListItems({
        userId: USER_ID,
        vocabularyListId: list.id,
        type: RequestType.Data,
      });

      expect(result.items).toHaveLength(1);
      expect(result.total).toBe(0);
    });
  });

  describe('getUserVocabularyListItemStatusCounts', () => {
    it('returns counts grouped by status for the user and list', async () => {
      const { list } = await seedLearningItems({
        values: [
          { value: 'apple', encounterCount: 0, offsetSeconds: 0, status: LearningStatus.Waiting },
          { value: 'banana', encounterCount: 0, offsetSeconds: 1, status: LearningStatus.Learning },
          { value: 'cherry', encounterCount: 0, offsetSeconds: 2, status: LearningStatus.Learning },
          { value: 'date', encounterCount: 0, offsetSeconds: 3, status: LearningStatus.Known },
        ],
      });

      const counts = await getUserVocabularyListItemStatusCounts({ userId: USER_ID, vocabularyListId: list.id });

      expect(counts).toEqual(
        expect.arrayContaining([
          { status: LearningStatus.Waiting, count: 1 },
          { status: LearningStatus.Learning, count: 2 },
          { status: LearningStatus.Known, count: 1 },
        ]),
      );
      expect(counts).toHaveLength(3);
    });

    it('scopes counts to the given list and user', async () => {
      const { list: listA } = await seedLearningItems({
        values: [{ value: 'swim', encounterCount: 0, offsetSeconds: 0, status: LearningStatus.Known }],
        listTitle: 'Oxford 5000 A1',
      });
      await seedLearningItems({
        values: [{ value: 'fly', encounterCount: 0, offsetSeconds: 0, status: LearningStatus.Known }],
        listTitle: 'Oxford 5000 A2',
      });
      await seedLearningItems({
        userId: 'other-learning-items-user',
        values: [{ value: 'read', encounterCount: 0, offsetSeconds: 0, status: LearningStatus.Known }],
        listTitle: 'Oxford 5000 A1',
      });

      const counts = await getUserVocabularyListItemStatusCounts({ userId: USER_ID, vocabularyListId: listA.id });

      expect(counts).toEqual([{ status: LearningStatus.Known, count: 1 }]);
    });
  });
});
