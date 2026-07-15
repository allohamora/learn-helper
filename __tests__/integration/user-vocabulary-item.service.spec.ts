import { and, eq } from 'drizzle-orm';
import { describe, expect, it } from 'vitest';
import { db } from '@/server/db/db.service';
import { event, user, userVocabularyItem, vocabularyItem } from '@/server/db/db.schema';
import { Exception } from '@/server/utils/exception.utils';
import { createMissingVocabularyItems } from '@/server/vocabulary/vocabulary-item.repository';
import { createVocabularyListItemsIfNotExist } from '@/server/vocabulary/vocabulary-list-item.repository';
import { findOrCreateVocabularyListByTitle } from '@/server/vocabulary/vocabulary-list.service';
import { addVocabularyListToUser } from '@/server/user-vocabulary/user-vocabulary-list.service';
import {
  getUserVocabularyListItems,
  getUserVocabularyListLearningItems,
  getUserVocabularyListProgress,
  setUserVocabularyItemStatus,
  undoUserVocabularyItemStatus,
  updateUserVocabularyItemTranslation,
} from '@/server/user-vocabulary/user-vocabulary-item.service';
import { EventType } from '@/const/event';
import { LearningStatus, PartOfSpeech } from '@/const/vocabulary';

const MISSING_ID = '00000000-0000-7000-8000-000000000000';
const BASE_TIME = new Date('2026-01-01T00:00:00Z').getTime();

const seedTestUser = async (userId: string) => {
  await db.insert(user).values({ id: userId, name: `Test User ${userId}`, email: `${userId}@example.com` });
};

const seedUserItem = async ({
  userSuffix,
  value = 'run',
  listTitle = 'Oxford 5000 A1',
}: {
  userSuffix: string;
  value?: string;
  listTitle?: string;
}) => {
  const userId = `user-${userSuffix}`;
  await seedTestUser(userId);

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
  const userList = await addVocabularyListToUser({ userId, vocabularyListId: list.id });

  const userItem = await db.query.userVocabularyItem.findFirst({
    where: and(eq(userVocabularyItem.userId, userId), eq(userVocabularyItem.vocabularyItemId, item.id)),
  });
  if (!userItem) throw new Error('expected user item to be created');

  return { userId, list, item, userList, userItem };
};

type SeedValue = { value: string; encounterCount: number; offsetSeconds: number; status?: LearningStatus };

const seedLearningUser = async ({ userSuffix, values }: { userSuffix: string; values: SeedValue[] }) => {
  const userId = `user-${userSuffix}`;
  await seedTestUser(userId);

  const list = await findOrCreateVocabularyListByTitle('Oxford 5000 A1');
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

  const userList = await addVocabularyListToUser({ userId, vocabularyListId: list.id });

  for (const { value, encounterCount, offsetSeconds, status = LearningStatus.Learning } of values) {
    const item = items.find((i) => i.value === value);
    if (!item) throw new Error(`expected item ${value} to be created`);

    await db
      .update(userVocabularyItem)
      .set({ status, encounterCount, enqueuedAt: new Date(BASE_TIME + offsetSeconds * 1000) })
      .where(and(eq(userVocabularyItem.userId, userId), eq(userVocabularyItem.vocabularyItemId, item.id)));
  }

  return { userId, list, userList };
};

describe('userVocabularyItemService', () => {
  describe('setUserVocabularyItemStatus', () => {
    it('sets the status and records a discovered event', async () => {
      const { userId, userList, userItem } = await seedUserItem({ userSuffix: 'set-status' });

      const result = await setUserVocabularyItemStatus({
        userId,
        userVocabularyListId: userList.id,
        userVocabularyItemId: userItem.id,
        status: LearningStatus.Known,
        durationMs: 1500,
      });

      expect(result).toEqual({ userVocabularyItemId: userItem.id, status: LearningStatus.Known });

      const updated = await db.query.userVocabularyItem.findFirst({ where: eq(userVocabularyItem.id, userItem.id) });
      expect(updated?.status).toBe(LearningStatus.Known);

      const events = await db.query.event.findMany({ where: eq(event.userVocabularyItemId, userItem.id) });
      expect(events).toMatchObject([
        {
          type: EventType.UserVocabularyItemDiscovered,
          userId,
          userVocabularyItemId: userItem.id,
          userVocabularyListId: userList.id,
          status: LearningStatus.Known,
          durationMs: 1500,
        },
      ]);
    });

    it('throws not found when the item is not linked to the given list', async () => {
      const { userId, userItem } = await seedUserItem({ userSuffix: 'set-status-unlinked' });

      await expect(
        setUserVocabularyItemStatus({
          userId,
          userVocabularyListId: MISSING_ID,
          userVocabularyItemId: userItem.id,
          status: LearningStatus.Known,
          durationMs: 0,
        }),
      ).rejects.toThrow(Exception);
    });

    it('throws not found when the item belongs to a different user than the one who owns the list', async () => {
      const { userItem } = await seedUserItem({ userSuffix: 'set-status-wrong-owner' });
      const { userId: otherUserId, userList: otherUserList } = await seedUserItem({
        userSuffix: 'set-status-other-owner',
        value: 'walk',
      });

      await expect(
        setUserVocabularyItemStatus({
          userId: otherUserId,
          userVocabularyListId: otherUserList.id,
          userVocabularyItemId: userItem.id,
          status: LearningStatus.Known,
          durationMs: 0,
        }),
      ).rejects.toThrow(Exception);
    });

    it('throws not found when the item exists for the user but is not linked to the given list', async () => {
      const userId = 'user-set-status-cross-list';
      await seedTestUser(userId);

      const runList = await findOrCreateVocabularyListByTitle('Oxford 5000 A1');
      const [runItem] = await createMissingVocabularyItems([
        { value: 'run', definition: 'run', uaTranslation: 'бігти', partOfSpeech: PartOfSpeech.Verb, spelling: 'run' },
      ]);
      if (!runItem) throw new Error('expected item to be created');
      await createVocabularyListItemsIfNotExist([{ vocabularyListId: runList.id, vocabularyItemId: runItem.id }]);
      const runUserList = await addVocabularyListToUser({ userId, vocabularyListId: runList.id });

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
      await addVocabularyListToUser({ userId, vocabularyListId: walkList.id });

      const walkUserItem = await db.query.userVocabularyItem.findFirst({
        where: and(eq(userVocabularyItem.userId, userId), eq(userVocabularyItem.vocabularyItemId, walkItem.id)),
      });
      if (!walkUserItem) throw new Error('expected user item to be created');

      await expect(
        setUserVocabularyItemStatus({
          userId,
          userVocabularyListId: runUserList.id,
          userVocabularyItemId: walkUserItem.id,
          status: LearningStatus.Known,
          durationMs: 0,
        }),
      ).rejects.toThrow(Exception);
    });
  });

  describe('undoUserVocabularyItemStatus', () => {
    it('reverts the status to waiting and records an undone event', async () => {
      const { userId, userList, userItem } = await seedUserItem({ userSuffix: 'undo-status' });

      await setUserVocabularyItemStatus({
        userId,
        userVocabularyListId: userList.id,
        userVocabularyItemId: userItem.id,
        status: LearningStatus.Known,
        durationMs: 1000,
      });

      const result = await undoUserVocabularyItemStatus({
        userId,
        userVocabularyListId: userList.id,
        userVocabularyItemId: userItem.id,
      });

      expect(result).toEqual({ userVocabularyItemId: userItem.id, status: LearningStatus.Waiting });

      const updated = await db.query.userVocabularyItem.findFirst({ where: eq(userVocabularyItem.id, userItem.id) });
      expect(updated?.status).toBe(LearningStatus.Waiting);

      const undoneEvent = await db.query.event.findFirst({
        where: and(
          eq(event.userVocabularyItemId, userItem.id),
          eq(event.type, EventType.UserVocabularyItemDiscoveryUndone),
        ),
      });
      expect(undoneEvent).toMatchObject({ durationMs: 1000, userVocabularyListId: userList.id });
    });

    it('throws not found when there is no active discovery event to undo', async () => {
      const { userId, userList, userItem } = await seedUserItem({ userSuffix: 'undo-no-event' });

      await expect(
        undoUserVocabularyItemStatus({ userId, userVocabularyListId: userList.id, userVocabularyItemId: userItem.id }),
      ).rejects.toThrow(Exception);
    });
  });

  describe('updateUserVocabularyItemTranslation', () => {
    it("updates the shared vocabulary item's translation and records an update event", async () => {
      const { userId, item, userList, userItem } = await seedUserItem({ userSuffix: 'update-translation' });

      const result = await updateUserVocabularyItemTranslation({
        userId,
        userVocabularyListId: userList.id,
        userVocabularyItemId: userItem.id,
        uaTranslation: 'бігати',
      });

      expect(result).toEqual({ userVocabularyItemId: userItem.id, uaTranslation: 'бігати' });

      const updatedItem = await db.query.vocabularyItem.findFirst({ where: eq(vocabularyItem.id, item.id) });
      expect(updatedItem?.uaTranslation).toBe('бігати');

      const events = await db.query.event.findMany({
        where: and(eq(event.userVocabularyItemId, userItem.id), eq(event.type, EventType.VocabularyItemUpdated)),
      });
      expect(events).toMatchObject([{ vocabularyItemId: item.id, fieldName: 'uaTranslation' }]);
    });

    it('throws not found when the item is not linked to the given list', async () => {
      const { userId, userItem } = await seedUserItem({ userSuffix: 'update-translation-unlinked' });

      await expect(
        updateUserVocabularyItemTranslation({
          userId,
          userVocabularyListId: MISSING_ID,
          userVocabularyItemId: userItem.id,
          uaTranslation: 'бігати',
        }),
      ).rejects.toThrow(Exception);
    });
  });

  describe('getUserVocabularyListItems', () => {
    it("returns the user's items for their list", async () => {
      const { userId, userList } = await seedUserItem({ userSuffix: 'list-items', value: 'run' });

      const result = await getUserVocabularyListItems({ userId, userVocabularyListId: userList.id });

      expect(result.items.map((item) => item.value)).toEqual(['run']);
      expect(result.total).toBe(1);
    });

    it('throws not found for a non-existent user list', async () => {
      const { userId } = await seedUserItem({ userSuffix: 'list-items-missing' });

      await expect(getUserVocabularyListItems({ userId, userVocabularyListId: MISSING_ID })).rejects.toThrow(Exception);
    });
  });

  describe('getUserVocabularyListLearningItems', () => {
    it('returns an interleaved batch of new and review items', async () => {
      const { userId, userList } = await seedLearningUser({
        userSuffix: 'learning-items',
        values: [
          { value: 'apple', encounterCount: 0, offsetSeconds: 0 },
          { value: 'banana', encounterCount: 0, offsetSeconds: 1 },
          { value: 'cherry', encounterCount: 1, offsetSeconds: 0 },
          { value: 'date', encounterCount: 1, offsetSeconds: 1 },
        ],
      });

      const batch = await getUserVocabularyListLearningItems({ userId, userVocabularyListId: userList.id });

      expect(batch.map((item) => item.vocabularyItem.value)).toEqual(['apple', 'cherry', 'date', 'banana']);
    });

    it('throws not found for a non-existent user list', async () => {
      const userId = 'user-learning-items-missing';
      await seedTestUser(userId);

      await expect(getUserVocabularyListLearningItems({ userId, userVocabularyListId: MISSING_ID })).rejects.toThrow(
        Exception,
      );
    });
  });

  describe('getUserVocabularyListProgress', () => {
    it('returns totals per status, defaulting missing statuses to zero', async () => {
      const { userId, userList } = await seedLearningUser({
        userSuffix: 'progress',
        values: [
          { value: 'apple', encounterCount: 0, offsetSeconds: 0, status: LearningStatus.Waiting },
          { value: 'banana', encounterCount: 0, offsetSeconds: 1, status: LearningStatus.Learning },
          { value: 'cherry', encounterCount: 0, offsetSeconds: 2, status: LearningStatus.Learning },
        ],
      });

      const progress = await getUserVocabularyListProgress({ userId, userVocabularyListId: userList.id });

      expect(progress).toEqual({ total: 3, waiting: 1, learning: 2, learned: 0, known: 0 });
    });

    it('throws not found for a non-existent user list', async () => {
      const userId = 'user-progress-missing';
      await seedTestUser(userId);

      await expect(getUserVocabularyListProgress({ userId, userVocabularyListId: MISSING_ID })).rejects.toThrow(
        Exception,
      );
    });
  });
});
