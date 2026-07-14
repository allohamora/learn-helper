import { asc, eq } from 'drizzle-orm';
import { describe, expect, it } from 'vitest';
import { countItems } from '@/server/db/db.utils';
import { db } from '@/server/db/db.service';
import { user, userVocabularyItem, vocabularyItem } from '@/server/db/db.schema';
import { createMissingVocabularyItems } from '@/server/vocabulary/vocabulary-item.repository';
import { createVocabularyListItemsIfNotExist } from '@/server/vocabulary/vocabulary-list-item.repository';
import { findOrCreateVocabularyListByTitle } from '@/server/vocabulary/vocabulary-list.repository';
import {
  createUserVocabularyItemsFromList,
  getUserVocabularyListItemLinkOrThrow,
  updateUserVocabularyItemStatus,
} from '@/server/user-vocabulary/user-vocabulary-item.repository';
import { createUserVocabularyList } from '@/server/user-vocabulary/user-vocabulary-list.repository';
import { LearningStatus, PartOfSpeech } from '@/const/vocabulary';

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

  describe('getUserVocabularyListItemLinkOrThrow', () => {
    it('resolves when the list and item belong to the user and the item is linked to the list', async () => {
      const { userId, item, userItem, userList } = await seedUserItem({ userSuffix: 'linked' });
      if (!userList) throw new Error('expected user list to be created');

      await expect(
        getUserVocabularyListItemLinkOrThrow({
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

    it('throws when the list does not belong to the user', async () => {
      const { userId, userItem } = await seedUserItem({ userSuffix: 'no-list', enrollInList: false });

      await expect(
        getUserVocabularyListItemLinkOrThrow({
          userId,
          userVocabularyListId: '00000000-0000-7000-8000-000000000000',
          userVocabularyItemId: userItem.id,
        }),
      ).rejects.toThrow();
    });

    it('throws when the item does not belong to the user', async () => {
      const { userList } = await seedUserItem({ userSuffix: 'wrong-item-owner' });
      if (!userList) throw new Error('expected user list to be created');

      await expect(
        getUserVocabularyListItemLinkOrThrow({
          userId: 'someone-else',
          userVocabularyListId: userList.id,
          userVocabularyItemId: '00000000-0000-7000-8000-000000000000',
        }),
      ).rejects.toThrow();
    });

    it('throws when the item is not linked to the given list', async () => {
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
        getUserVocabularyListItemLinkOrThrow({
          userId,
          userVocabularyListId: runUserList.id,
          userVocabularyItemId: walkUserItem.id,
        }),
      ).rejects.toThrow();
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
});
