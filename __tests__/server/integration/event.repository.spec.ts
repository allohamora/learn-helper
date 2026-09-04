import { eq } from 'drizzle-orm';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { db } from '@/server/db/db.service';
import { event, user, userVocabularyItem } from '@/server/db/db.schema';
import { createMissingVocabularyItems } from '@/server/vocabulary/vocabulary-item.repository';
import { createVocabularyListItemsIfNotExist } from '@/server/vocabulary/vocabulary-list-item.repository';
import { findOrCreateVocabularyListByTitle } from '@/server/vocabulary/vocabulary-list.service';
import { createUserVocabularyItemsFromList } from '@/server/user-vocabulary/user-vocabulary-item.repository';
import { createUserVocabularyList } from '@/server/user-vocabulary/user-vocabulary-list.repository';
import { createFile, createReading } from '@/server/reading/reading.repository';
import {
  insertEvent,
  insertEvents,
  revertUserVocabularyItemDiscoveredEvent,
  updateCurrentHourReadingTimeSpentEvent,
} from '@/server/event/event.repository';
import { EventType, UserVocabularyItemTaskType } from '@/const/event';
import { LearningStatus, PartOfSpeech } from '@/const/vocabulary';

const USER_ID = 'user-1';

const seed = async () => {
  await db.insert(user).values({ id: USER_ID, name: 'Test User', email: `${USER_ID}@example.com` });

  const list = await findOrCreateVocabularyListByTitle('Oxford 5000 A1');
  const [item] = await createMissingVocabularyItems([
    {
      value: 'run',
      definition: 'to move fast on foot',
      uaTranslation: 'бігти',
      partOfSpeech: PartOfSpeech.Verb,
      spelling: '/rʌn/',
    },
  ]);
  if (!item) throw new Error('expected item to be created');

  await createVocabularyListItemsIfNotExist([{ vocabularyListId: list.id, vocabularyItemId: item.id }]);
  await createUserVocabularyItemsFromList({ userId: USER_ID, vocabularyListId: list.id });
  const userList = await createUserVocabularyList({ userId: USER_ID, vocabularyListId: list.id });
  if (!userList) throw new Error('expected user list to be created');

  const userItem = await db.query.userVocabularyItem.findFirst({ where: eq(userVocabularyItem.userId, USER_ID) });
  if (!userItem) throw new Error('expected user item to be created');

  return { userList, userItem };
};

describe('eventRepository', () => {
  describe('insertEvent', () => {
    it('inserts a discovered event row', async () => {
      const { userList, userItem } = await seed();

      await insertEvent({
        type: EventType.UserVocabularyItemDiscovered,
        userId: USER_ID,
        userVocabularyItemId: userItem.id,
        userVocabularyListId: userList.id,
        status: LearningStatus.Known,
        durationMs: 4321,
      });

      const events = await db.query.event.findMany({ where: eq(event.userVocabularyItemId, userItem.id) });
      expect(events).toMatchObject([
        {
          type: EventType.UserVocabularyItemDiscovered,
          userId: USER_ID,
          userVocabularyItemId: userItem.id,
          userVocabularyListId: userList.id,
          status: LearningStatus.Known,
          durationMs: 4321,
        },
      ]);
    });
  });

  describe('insertEvents', () => {
    it('inserts a batch of learning events', async () => {
      const { userList, userItem } = await seed();

      await insertEvents([
        {
          type: EventType.UserVocabularyItemTaskFailed,
          userId: USER_ID,
          userVocabularyItemId: userItem.id,
          userVocabularyListId: userList.id,
          userVocabularyItemTaskType: UserVocabularyItemTaskType.VocabularyItemToDefinition,
        },
        {
          type: EventType.UserVocabularyItemTaskPassed,
          userId: USER_ID,
          userVocabularyItemId: userItem.id,
          userVocabularyListId: userList.id,
          userVocabularyItemTaskType: UserVocabularyItemTaskType.DefinitionToVocabularyItem,
          durationMs: 1234,
        },
      ]);

      const events = await db.query.event.findMany({ where: eq(event.userVocabularyItemId, userItem.id) });
      expect(events).toHaveLength(2);
      expect(events).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ type: EventType.UserVocabularyItemTaskFailed }),
          expect.objectContaining({ type: EventType.UserVocabularyItemTaskPassed, durationMs: 1234 }),
        ]),
      );
    });
  });

  describe('revertUserVocabularyItemDiscoveredEvent', () => {
    it('marks the discovered event as reverted, returns it, and leaves other events untouched', async () => {
      const { userList, userItem } = await seed();

      await insertEvent({
        type: EventType.UserVocabularyItemDiscovered,
        userId: USER_ID,
        userVocabularyItemId: userItem.id,
        userVocabularyListId: userList.id,
        status: LearningStatus.Known,
        durationMs: 100,
      });
      await insertEvent({
        type: EventType.UserVocabularyItemMovedToNextStep,
        userId: USER_ID,
        userVocabularyItemId: userItem.id,
      });

      const reverted = await revertUserVocabularyItemDiscoveredEvent({
        userId: USER_ID,
        userVocabularyItemId: userItem.id,
      });

      expect(reverted).toMatchObject({ type: EventType.UserVocabularyItemDiscovered, durationMs: 100 });
      expect(reverted?.revertedAt).toEqual(expect.any(Date));
      // lastFlushedAt is reading-time-spent-bucketing-specific; a revert isn't a flush, so it stays null
      expect(reverted?.lastFlushedAt).toBeNull();

      const events = await db.query.event.findMany({ where: eq(event.userVocabularyItemId, userItem.id) });
      expect(events).toContainEqual(
        expect.objectContaining({ type: EventType.UserVocabularyItemDiscovered, revertedAt: expect.any(Date) }),
      );
      expect(events).toContainEqual(
        expect.objectContaining({ type: EventType.UserVocabularyItemMovedToNextStep, revertedAt: null }),
      );
    });

    it('returns undefined when there is no active discovered event', async () => {
      const { userItem } = await seed();

      const reverted = await revertUserVocabularyItemDiscoveredEvent({
        userId: USER_ID,
        userVocabularyItemId: userItem.id,
      });

      expect(reverted).toBeUndefined();
    });
  });

  describe('updateCurrentHourReadingTimeSpentEvent', () => {
    afterEach(() => {
      vi.useRealTimers();
    });

    const seedReading = async () => {
      const createdFile = await createFile({
        userId: USER_ID,
        fileName: 'book.pdf',
        filePath: `uploads/${USER_ID}/book.pdf`,
        mimeType: 'application/pdf',
        sizeBytes: 1,
        hash: 'book',
      });

      return createReading({ userId: USER_ID, fileId: createdFile.id, title: 'Book', totalPages: 10 });
    };

    // sets fake time synchronously, then restores real timers before awaiting the DB call - avoids
    // fake timers interfering with the underlying async I/O (see statistics.service.spec.ts for the same pattern)
    const updateAt = (at: string, data: { readingId: string; addDurationMs: number; currentPage: number }) => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date(at));
      const result = updateCurrentHourReadingTimeSpentEvent({ userId: USER_ID, ...data });
      vi.useRealTimers();

      return result;
    };

    it('returns undefined when no reading-time-spent event exists for the reading yet', async () => {
      await db.insert(user).values({ id: USER_ID, name: 'Test User', email: `${USER_ID}@example.com` });
      const reading = await seedReading();

      const updated = await updateCurrentHourReadingTimeSpentEvent({
        userId: USER_ID,
        readingId: reading.id,
        addDurationMs: 300_000,
        currentPage: 2,
      });

      expect(updated).toBeUndefined();
      const events = await db.query.event.findMany({ where: eq(event.readingId, reading.id) });
      expect(events).toHaveLength(0);
    });

    it('returns undefined when the latest event is from a previous clock hour', async () => {
      await db.insert(user).values({ id: USER_ID, name: 'Test User', email: `${USER_ID}@example.com` });
      const reading = await seedReading();
      await db.insert(event).values({
        userId: USER_ID,
        readingId: reading.id,
        type: EventType.ReadingTimeSpent,
        durationMs: 300_000,
        metadata: { currentPage: 2 },
        createdAt: new Date('2026-05-01T09:55:00.000Z'),
      });

      const updated = await updateAt('2026-05-01T10:05:00.000Z', {
        readingId: reading.id,
        addDurationMs: 300_000,
        currentPage: 4,
      });

      expect(updated).toBeUndefined();
      const events = await db.query.event.findMany({ where: eq(event.readingId, reading.id) });
      expect(events).toMatchObject([{ durationMs: 300_000, metadata: { currentPage: 2 } }]);
    });

    it('accumulates duration and refreshes metadata when the latest event is in the current clock hour', async () => {
      await db.insert(user).values({ id: USER_ID, name: 'Test User', email: `${USER_ID}@example.com` });
      const reading = await seedReading();
      await db.insert(event).values({
        userId: USER_ID,
        readingId: reading.id,
        type: EventType.ReadingTimeSpent,
        durationMs: 300_000,
        metadata: { currentPage: 2 },
        createdAt: new Date('2026-05-01T10:05:00.000Z'),
      });

      const updated = await updateAt('2026-05-01T10:50:00.000Z', {
        readingId: reading.id,
        addDurationMs: 300_000,
        currentPage: 4,
      });

      expect(updated).toMatchObject({ durationMs: 600_000, metadata: { currentPage: 4 } });
      expect(updated!.lastFlushedAt).not.toBeNull();
      expect(updated!.lastFlushedAt!.getTime()).toBeGreaterThan(updated!.createdAt.getTime());
    });
  });
});
