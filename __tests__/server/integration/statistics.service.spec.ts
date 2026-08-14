import { describe, expect, it, vi } from 'vitest';
import { eq } from 'drizzle-orm';
import { EventType, UserVocabularyItemTaskType } from '@/const/event';
import { LearningStatus, PartOfSpeech } from '@/const/vocabulary';
import { db } from '@/server/db/db.service';
import { event, user, userVocabularyItem } from '@/server/db/db.schema';
import { getStatistics } from '@/server/statistics/statistics.service';
import { createMissingVocabularyItems } from '@/server/vocabulary/vocabulary-item.repository';
import { createVocabularyListItemsIfNotExist } from '@/server/vocabulary/vocabulary-list-item.repository';
import { findOrCreateVocabularyListByTitle } from '@/server/vocabulary/vocabulary-list.service';
import { createUserVocabularyItemsFromList } from '@/server/user-vocabulary/user-vocabulary-item.repository';

const USER_ID = 'statistics-user';

const toDateOnlyString = (date: Date) => date.toISOString().slice(0, 10);

const daysAgo = (days: number) => {
  const date = new Date();
  date.setUTCDate(date.getUTCDate() - days);
  return date;
};

const seed = async (itemCount = 1, userId = USER_ID) => {
  await db.insert(user).values({ id: userId, name: 'Statistics User', email: `${userId}@example.com` });
  const list = await findOrCreateVocabularyListByTitle(`Statistics ${userId}`);
  const itemPrefix = userId === USER_ID ? 'item' : `${userId}-item`;
  const items = await createMissingVocabularyItems(
    Array.from({ length: itemCount }, (_, index) => ({
      value: `${itemPrefix}-${index}`,
      definition: `definition-${index}`,
      uaTranslation: `translation-${index}`,
      partOfSpeech: PartOfSpeech.Noun,
      spelling: `${itemPrefix}-${index}`,
    })),
  );
  await createVocabularyListItemsIfNotExist(
    items.map((item) => ({ vocabularyListId: list.id, vocabularyItemId: item.id })),
  );
  await createUserVocabularyItemsFromList({ userId, vocabularyListId: list.id });

  const userItems = await db.query.userVocabularyItem.findMany({
    where: eq(userVocabularyItem.userId, userId),
    with: { vocabularyItem: true },
  });

  return { items, userItems };
};

describe('statisticsService', () => {
  it('returns empty lifetime statistics and seven zero-filled UTC days', async () => {
    await seed();

    const result = await getStatistics({ userId: USER_ID });

    expect(result.general).toEqual({
      totalDiscoveredItems: 0,
      totalDiscoveryUndos: 0,
      totalMistakesMade: 0,
      totalCompletedTasks: 0,
      totalRetriesCompleted: 0,
      totalShowcasesCompleted: 0,
      totalItemsMovedToNextStep: 0,
      totalHintsViewed: 0,
      totalItemsUpdated: 0,
      totalItemsGenerated: 0,
      totalProgressResets: 0,
      totalItemsRemovedFromList: 0,
      totalReadingsUploaded: 0,
      totalAiCostsInNanoDollars: 0,
      totalInputTokens: 0,
      totalOutputTokens: 0,
      totalLearningDurationMs: 0,
      totalDiscoveringDurationMs: 0,
      averageTimePerTaskMs: 0,
      averageTimePerDiscoveryMs: 0,
    });
    expect(result.discoveringPerDay).toHaveLength(7);
    expect(result.learningPerDay).toHaveLength(7);
    expect(result.costPerDay).toHaveLength(7);
    expect(result.itemsUpdatedPerDay).toHaveLength(7);
    expect(result.topMistakes).toEqual([]);
    expect(result.topHintedItems).toEqual([]);
    expect(result.discoveringPerDay).toEqual(
      expect.arrayContaining([expect.objectContaining({ learningCount: 0, knownCount: 0, durationMs: 0 })]),
    );
    expect(result.learningPerDay).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          completedTasks: 0,
          completedRetries: 0,
          completedShowcases: 0,
          mistakesMade: 0,
          hintsViewed: 0,
          durationMs: 0,
        }),
      ]),
    );
    expect(result.costPerDay).toEqual(
      expect.arrayContaining([expect.objectContaining({ costInNanoDollars: 0, inputTokens: 0, outputTokens: 0 })]),
    );
  });

  it('returns correct lifetime statistics for every reportable event type and isolates users', async () => {
    const { items, userItems } = await seed();
    const item = items[0];
    const userItem = userItems[0];
    if (!item || !userItem) throw new Error('expected a seeded vocabulary item');

    await db.insert(event).values([
      {
        userId: USER_ID,
        userVocabularyItemId: userItem.id,
        type: EventType.UserVocabularyItemDiscovered,
        status: LearningStatus.Learning,
        durationMs: 3000,
      },
      {
        userId: USER_ID,
        userVocabularyItemId: userItem.id,
        type: EventType.UserVocabularyItemDiscovered,
        status: LearningStatus.Known,
        durationMs: 2000,
      },
      ...Array.from({ length: 2 }, () => ({
        userId: USER_ID,
        userVocabularyItemId: userItem.id,
        type: EventType.UserVocabularyItemTaskFailed,
        userVocabularyItemTaskType: UserVocabularyItemTaskType.VocabularyItemToDefinition,
      })),
      ...[5000, 3000].map((durationMs) => ({
        userId: USER_ID,
        userVocabularyItemId: userItem.id,
        type: EventType.UserVocabularyItemTaskPassed,
        userVocabularyItemTaskType: UserVocabularyItemTaskType.VocabularyItemToDefinition,
        durationMs,
      })),
      ...[1000, 1000].map((durationMs) => ({
        userId: USER_ID,
        userVocabularyItemId: userItem.id,
        type: EventType.UserVocabularyItemTaskShowcaseViewed,
        durationMs,
      })),
      ...[5000, 1000].map((durationMs) => ({
        userId: USER_ID,
        userVocabularyItemId: userItem.id,
        type: EventType.UserVocabularyItemTaskRetryPassed,
        userVocabularyItemTaskType: UserVocabularyItemTaskType.DefinitionToVocabularyItem,
        durationMs,
      })),
      ...Array.from({ length: 2 }, () => ({
        userId: USER_ID,
        userVocabularyItemId: userItem.id,
        type: EventType.UserVocabularyItemMovedToNextStep,
      })),
      ...Array.from({ length: 3 }, () => ({
        userId: USER_ID,
        userVocabularyItemId: userItem.id,
        type: EventType.UserVocabularyItemTaskHintUsed,
        userVocabularyItemTaskType: UserVocabularyItemTaskType.VocabularyItemToDefinition,
      })),
      ...Array.from({ length: 2 }, () => ({
        userId: USER_ID,
        userVocabularyItemId: userItem.id,
        vocabularyItemId: item.id,
        type: EventType.VocabularyItemUpdated,
        fieldName: 'uaTranslation',
      })),
      {
        userId: USER_ID,
        type: EventType.UserVocabularyItemTaskGenerated,
        userVocabularyItemIds: [userItem.id],
        costInNanoDollars: 3_500_000_000,
        inputTokens: 1500,
        outputTokens: 3000,
      },
      {
        userId: USER_ID,
        type: EventType.UserVocabularyItemTaskGenerated,
        userVocabularyItemIds: [userItem.id],
        costInNanoDollars: 1_500_000_000,
        inputTokens: 500,
        outputTokens: 1000,
      },
      {
        userId: USER_ID,
        type: EventType.VocabularyItemGenerated,
        costInNanoDollars: 700_000_000,
        inputTokens: 300,
        outputTokens: 600,
      },
      {
        userId: USER_ID,
        type: EventType.VocabularyItemGenerated,
        costInNanoDollars: 300_000_000,
        inputTokens: 100,
        outputTokens: 200,
      },
      ...Array.from({ length: 2 }, () => ({
        userId: USER_ID,
        userVocabularyItemId: userItem.id,
        type: EventType.UserVocabularyItemProgressReset,
        status: LearningStatus.Learning,
      })),
      {
        userId: USER_ID,
        userVocabularyItemId: userItem.id,
        vocabularyItemId: item.id,
        type: EventType.UserVocabularyItemRemovedFromList,
        status: LearningStatus.Waiting,
      },
      {
        userId: USER_ID,
        type: EventType.ReadingUploaded,
      },
    ]);

    const otherUserId = 'other-statistics-user';
    await db.insert(user).values({ id: otherUserId, name: 'Other User', email: `${otherUserId}@example.com` });
    await db.insert(event).values({
      userId: otherUserId,
      type: EventType.UserVocabularyItemTaskGenerated,
      costInNanoDollars: 9_000_000_000,
      inputTokens: 999,
      outputTokens: 999,
    });

    const result = await getStatistics({ userId: USER_ID });

    expect(result.general).toEqual({
      totalDiscoveredItems: 2,
      totalDiscoveryUndos: 0,
      totalMistakesMade: 2,
      totalCompletedTasks: 2,
      totalRetriesCompleted: 2,
      totalShowcasesCompleted: 2,
      totalItemsMovedToNextStep: 2,
      totalHintsViewed: 3,
      totalItemsUpdated: 2,
      totalItemsGenerated: 2,
      totalProgressResets: 2,
      totalItemsRemovedFromList: 1,
      totalReadingsUploaded: 1,
      totalAiCostsInNanoDollars: 6_000_000_000,
      totalInputTokens: 2400,
      totalOutputTokens: 4800,
      totalLearningDurationMs: 16000,
      totalDiscoveringDurationMs: 5000,
      averageTimePerTaskMs: 4000,
      averageTimePerDiscoveryMs: 2500,
    });
    expect(result.costPerDay).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          costInNanoDollars: 6_000_000_000,
          inputTokens: 2400,
          outputTokens: 4800,
        }),
      ]),
    );
  });

  it('limits daily series to seven UTC days while retaining older events in lifetime totals', async () => {
    const { userItems } = await seed();
    const userItem = userItems[0];
    if (!userItem) throw new Error('expected a seeded user vocabulary item');

    const today = new Date();
    const yesterday = daysAgo(1);
    const outsideRange = daysAgo(30);

    await db.insert(event).values([
      {
        userId: USER_ID,
        userVocabularyItemId: userItem.id,
        type: EventType.UserVocabularyItemDiscovered,
        status: LearningStatus.Learning,
        durationMs: 2000,
        createdAt: today,
      },
      {
        userId: USER_ID,
        userVocabularyItemId: userItem.id,
        type: EventType.UserVocabularyItemDiscovered,
        status: LearningStatus.Known,
        durationMs: 1000,
        createdAt: yesterday,
      },
      {
        userId: USER_ID,
        userVocabularyItemId: userItem.id,
        type: EventType.UserVocabularyItemTaskPassed,
        durationMs: 5000,
        createdAt: today,
      },
      {
        userId: USER_ID,
        userVocabularyItemId: userItem.id,
        type: EventType.UserVocabularyItemTaskRetryPassed,
        durationMs: 3000,
        createdAt: yesterday,
      },
      {
        userId: USER_ID,
        userVocabularyItemId: userItem.id,
        type: EventType.UserVocabularyItemTaskShowcaseViewed,
        durationMs: 1000,
        createdAt: today,
      },
      {
        userId: USER_ID,
        userVocabularyItemId: userItem.id,
        type: EventType.UserVocabularyItemTaskFailed,
        createdAt: today,
      },
      {
        userId: USER_ID,
        userVocabularyItemId: userItem.id,
        type: EventType.UserVocabularyItemTaskHintUsed,
        createdAt: yesterday,
      },
      {
        userId: USER_ID,
        type: EventType.UserVocabularyItemTaskGenerated,
        costInNanoDollars: 1_000_000,
        inputTokens: 100,
        outputTokens: 200,
        createdAt: today,
      },
      {
        userId: USER_ID,
        userVocabularyItemId: userItem.id,
        type: EventType.UserVocabularyItemDiscovered,
        status: LearningStatus.Learning,
        durationMs: 4000,
        createdAt: outsideRange,
      },
      {
        userId: USER_ID,
        userVocabularyItemId: userItem.id,
        type: EventType.UserVocabularyItemTaskPassed,
        durationMs: 7000,
        createdAt: outsideRange,
      },
      {
        userId: USER_ID,
        type: EventType.UserVocabularyItemTaskGenerated,
        costInNanoDollars: 2_000_000,
        inputTokens: 200,
        outputTokens: 400,
        createdAt: outsideRange,
      },
    ]);

    const result = await getStatistics({ userId: USER_ID });
    const todayDate = toDateOnlyString(today);
    const yesterdayDate = toDateOnlyString(yesterday);

    expect(result.general).toMatchObject({
      totalDiscoveredItems: 3,
      totalCompletedTasks: 2,
      totalAiCostsInNanoDollars: 3_000_000,
      totalDiscoveringDurationMs: 7000,
      totalLearningDurationMs: 16000,
    });
    expect(result.discoveringPerDay.find(({ date }) => date === todayDate)).toMatchObject({
      learningCount: 1,
      knownCount: 0,
      durationMs: 2000,
    });
    expect(result.discoveringPerDay.find(({ date }) => date === yesterdayDate)).toMatchObject({
      learningCount: 0,
      knownCount: 1,
      durationMs: 1000,
    });
    expect(result.learningPerDay.find(({ date }) => date === todayDate)).toMatchObject({
      completedTasks: 1,
      completedRetries: 0,
      completedShowcases: 1,
      mistakesMade: 1,
      hintsViewed: 0,
      durationMs: 6000,
    });
    expect(result.learningPerDay.find(({ date }) => date === yesterdayDate)).toMatchObject({
      completedTasks: 0,
      completedRetries: 1,
      completedShowcases: 0,
      mistakesMade: 0,
      hintsViewed: 1,
      durationMs: 3000,
    });
    expect(result.costPerDay.find(({ date }) => date === todayDate)).toMatchObject({
      costInNanoDollars: 1_000_000,
      inputTokens: 100,
      outputTokens: 200,
    });
    expect(result.discoveringPerDay.find(({ date }) => date === toDateOnlyString(outsideRange))).toBeUndefined();
  });

  it('includes events at both UTC day boundaries', async () => {
    const { userItems } = await seed();
    const userItem = userItems[0];
    if (!userItem) throw new Error('expected a seeded user vocabulary item');

    // example utc: 22.07.2026, 00:00:00.000
    const startOfToday = new Date();
    startOfToday.setUTCHours(0, 0, 0, 0);

    // example utc: 22.07.2026, 23:59:59.999
    const endOfToday = new Date();
    endOfToday.setUTCHours(23, 59, 59, 999);

    await db.insert(event).values([
      {
        userId: USER_ID,
        userVocabularyItemId: userItem.id,
        type: EventType.UserVocabularyItemDiscovered,
        status: LearningStatus.Learning,
        durationMs: 1000,
        createdAt: startOfToday,
      },
      {
        userId: USER_ID,
        userVocabularyItemId: userItem.id,
        type: EventType.UserVocabularyItemDiscovered,
        status: LearningStatus.Known,
        durationMs: 2000,
        createdAt: endOfToday,
      },
    ]);

    const result = await getStatistics({ userId: USER_ID });

    // learning event in example utc: 22.07.2026, 00:00:00.000 with 1000
    // known event in example utc: 22.07.2026, 23:59:59.999 with 2000
    expect(result.discoveringPerDay.at(-1)).toMatchObject({
      date: toDateOnlyString(startOfToday),
      learningCount: 1,
      knownCount: 1,
      durationMs: 3000,
    });
  });

  it('returns the same events in different daily buckets for different timezones', async () => {
    const { items, userItems } = await seed();
    const item = items[0];
    const userItem = userItems[0];
    if (!item || !userItem) throw new Error('expected a seeded vocabulary item');

    await db.insert(event).values([
      {
        userId: USER_ID,
        userVocabularyItemId: userItem.id,
        type: EventType.UserVocabularyItemDiscovered,
        status: LearningStatus.Learning,
        durationMs: 1000,
        // utc: 2026-07-24, 21:30
        // kyiv: 2026-07-25, 00:30
        // new york: 2026-07-24, 17:30
        createdAt: new Date('2026-07-24T21:30:00.000Z'),
      },
      {
        userId: USER_ID,
        userVocabularyItemId: userItem.id,
        type: EventType.UserVocabularyItemDiscovered,
        status: LearningStatus.Known,
        durationMs: 2000,
        // utc: 2026-07-25, 01:30
        // kyiv: 2026-07-25, 04:30
        // new york: 2026-07-24, 21:30
        createdAt: new Date('2026-07-25T01:30:00.000Z'),
      },
      {
        userId: USER_ID,
        userVocabularyItemId: userItem.id,
        type: EventType.UserVocabularyItemTaskPassed,
        durationMs: 5000,
        createdAt: new Date('2026-07-24T21:30:00.000Z'),
      },
      {
        userId: USER_ID,
        type: EventType.UserVocabularyItemTaskGenerated,
        costInNanoDollars: 1234,
        inputTokens: 10,
        outputTokens: 20,
        createdAt: new Date('2026-07-24T21:30:00.000Z'),
      },
      {
        userId: USER_ID,
        userVocabularyItemId: userItem.id,
        vocabularyItemId: item.id,
        type: EventType.VocabularyItemUpdated,
        fieldName: 'uaTranslation',
        createdAt: new Date('2026-07-24T21:30:00.000Z'),
      },
    ]);

    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-07-25T02:00:00.000Z'));
    const statistics = [
      getStatistics({ userId: USER_ID, timezone: 'UTC' }),
      getStatistics({ userId: USER_ID, timezone: 'Europe/Kyiv' }),
      getStatistics({ userId: USER_ID, timezone: 'America/New_York' }),
    ];
    vi.useRealTimers();

    const [utc, kyiv, newYork] = await Promise.all(statistics);

    // learning event in utc: 2026-07-24, 21:30
    expect(utc.discoveringPerDay.find(({ date }) => date === '2026-07-24')).toMatchObject({
      learningCount: 1,
      knownCount: 0,
    });
    // known event in utc: 2026-07-25, 01:30
    expect(utc.discoveringPerDay.find(({ date }) => date === '2026-07-25')).toMatchObject({
      learningCount: 0,
      knownCount: 1,
    });
    // learning event in kyiv: 2026-07-25, 00:30 with 1000
    // known event in kyiv: 2026-07-25, 04:30 with 2000
    expect(kyiv.discoveringPerDay.at(-1)).toMatchObject({
      date: '2026-07-25',
      learningCount: 1,
      knownCount: 1,
      durationMs: 3000,
    });
    // task passed event in kyiv: 2026-07-25, 00:30
    expect(kyiv.learningPerDay.at(-1)).toMatchObject({ date: '2026-07-25', completedTasks: 1, durationMs: 5000 });
    // task generated event in kyiv: 2026-07-25, 00:30
    expect(kyiv.costPerDay.at(-1)).toMatchObject({
      date: '2026-07-25',
      costInNanoDollars: 1234,
      inputTokens: 10,
      outputTokens: 20,
    });
    // vocabulary item updated event in kyiv: 2026-07-25, 00:30
    expect(kyiv.itemsUpdatedPerDay.at(-1)).toMatchObject({ date: '2026-07-25', uaTranslation: 1 });
    // learning event in new york: 2026-07-24, 17:30 with 1000
    // known event in new york: 2026-07-24, 21:30 with 2000
    expect(newYork.discoveringPerDay.at(-1)).toMatchObject({
      date: '2026-07-24',
      learningCount: 1,
      knownCount: 1,
      durationMs: 3000,
    });
  });

  it('uses local-day boundaries across a daylight-saving transition', async () => {
    const { userItems } = await seed();
    const userItem = userItems[0];
    if (!userItem) throw new Error('expected a seeded user vocabulary item');

    await db.insert(event).values([
      {
        userId: USER_ID,
        userVocabularyItemId: userItem.id,
        type: EventType.UserVocabularyItemDiscovered,
        status: LearningStatus.Learning,
        durationMs: 100,
        // utc: 2026-03-02, 04:59:59.999
        // new york: 2026-03-01, 23:59:59.999 (EST)
        createdAt: new Date('2026-03-02T04:59:59.999Z'),
      },
      {
        userId: USER_ID,
        userVocabularyItemId: userItem.id,
        type: EventType.UserVocabularyItemDiscovered,
        status: LearningStatus.Learning,
        durationMs: 1000,
        // utc: 2026-03-02, 05:00:00.000
        // new york: 2026-03-02, 00:00:00.000 (EST)
        createdAt: new Date('2026-03-02T05:00:00.000Z'),
      },
      {
        userId: USER_ID,
        userVocabularyItemId: userItem.id,
        type: EventType.UserVocabularyItemDiscovered,
        status: LearningStatus.Learning,
        durationMs: 2000,
        // utc: 2026-03-08, 05:00:00.000
        // new york: 2026-03-08, 00:00:00.000 (EST)
        createdAt: new Date('2026-03-08T05:00:00.000Z'),
      },
      {
        userId: USER_ID,
        userVocabularyItemId: userItem.id,
        type: EventType.UserVocabularyItemDiscovered,
        status: LearningStatus.Known,
        durationMs: 3000,
        // utc: 2026-03-09, 03:59:59.999
        // new york: 2026-03-08, 23:59:59.999 (EDT)
        createdAt: new Date('2026-03-09T03:59:59.999Z'),
      },
      {
        userId: USER_ID,
        userVocabularyItemId: userItem.id,
        type: EventType.UserVocabularyItemDiscovered,
        status: LearningStatus.Known,
        durationMs: 4000,
        // utc: 2026-03-09, 04:00:00.000
        // new york: 2026-03-09, 00:00:00.000 (EDT)
        createdAt: new Date('2026-03-09T04:00:00.000Z'),
      },
    ]);

    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-03-08T16:00:00.000Z'));
    const statistics = getStatistics({ userId: USER_ID, timezone: 'America/New_York' });
    vi.useRealTimers();

    const result = await statistics;

    expect(result.discoveringPerDay).toHaveLength(7);
    // learning event in new york: 2026-03-02, 00:00:00.000 with 1000
    expect(result.discoveringPerDay[0]).toMatchObject({
      date: '2026-03-02',
      learningCount: 1,
      knownCount: 0,
      durationMs: 1000,
    });
    // learning event in new york: 2026-03-08, 00:00:00.000 with 2000
    // known event in new york: 2026-03-08, 23:59:59.999 with 3000
    expect(result.discoveringPerDay.at(-1)).toMatchObject({
      date: '2026-03-08',
      learningCount: 1,
      knownCount: 1,
      durationMs: 5000,
    });
    // learning event in new york: 2026-03-01, 23:59:59.999 with 100 — one tick before the window, dropped
    expect(result.discoveringPerDay.find(({ date }) => date === '2026-03-01')).toBeUndefined();
    // known event in new york: 2026-03-09, 00:00:00.000 with 4000 — one day after the window, dropped
    expect(result.discoveringPerDay.find(({ date }) => date === '2026-03-09')).toBeUndefined();
  });

  it('includes reverted discoveries as historical activity', async () => {
    const { userItems } = await seed();
    const userItem = userItems[0];
    if (!userItem) throw new Error('expected a seeded user vocabulary item');

    await db.insert(event).values([
      {
        userId: USER_ID,
        userVocabularyItemId: userItem.id,
        type: EventType.UserVocabularyItemDiscovered,
        status: LearningStatus.Known,
        durationMs: 1000,
        revertedAt: new Date(),
      },
      {
        userId: USER_ID,
        userVocabularyItemId: userItem.id,
        type: EventType.UserVocabularyItemDiscoveryUndone,
        status: LearningStatus.Known,
        durationMs: 1000,
      },
      {
        userId: USER_ID,
        userVocabularyItemId: userItem.id,
        type: EventType.UserVocabularyItemDiscovered,
        status: LearningStatus.Learning,
        durationMs: 3000,
      },
    ]);

    const result = await getStatistics({ userId: USER_ID });
    const today = result.discoveringPerDay.at(-1);

    expect(result.general).toMatchObject({
      totalDiscoveredItems: 2,
      totalDiscoveryUndos: 1,
      totalDiscoveringDurationMs: 4000,
      averageTimePerDiscoveryMs: 2000,
    });
    expect(today).toMatchObject({ learningCount: 1, knownCount: 1, durationMs: 4000 });
  });

  it('counts translation updates per day while retaining all updated fields in the general total', async () => {
    const { items, userItems } = await seed();
    const item = items[0];
    const userItem = userItems[0];
    if (!item || !userItem) throw new Error('expected a seeded vocabulary item');

    await db.insert(event).values([
      {
        userId: USER_ID,
        userVocabularyItemId: userItem.id,
        vocabularyItemId: item.id,
        type: EventType.VocabularyItemUpdated,
        fieldName: 'uaTranslation',
      },
      {
        userId: USER_ID,
        userVocabularyItemId: userItem.id,
        vocabularyItemId: item.id,
        type: EventType.VocabularyItemUpdated,
        fieldName: 'uaTranslation',
      },
      {
        userId: USER_ID,
        userVocabularyItemId: userItem.id,
        vocabularyItemId: item.id,
        type: EventType.VocabularyItemUpdated,
        fieldName: 'definition',
      },
    ]);

    const result = await getStatistics({ userId: USER_ID });

    expect(result.general.totalItemsUpdated).toBe(3);
    expect(result.itemsUpdatedPerDay.at(-1)?.uaTranslation).toBe(2);
  });

  it('returns the top 20 mistakes and hinted items ordered by event count', async () => {
    const { userItems } = await seed(21);
    const mistakeEvents = userItems.flatMap((item, index) =>
      Array.from({ length: index + 1 }, () => ({
        userId: USER_ID,
        userVocabularyItemId: item.id,
        type: EventType.UserVocabularyItemTaskFailed,
      })),
    );
    const hintEvents = userItems.flatMap((item, index) =>
      Array.from({ length: userItems.length - index }, () => ({
        userId: USER_ID,
        userVocabularyItemId: item.id,
        type: EventType.UserVocabularyItemTaskHintUsed,
      })),
    );
    await db.insert(event).values([...mistakeEvents, ...hintEvents]);

    const { userItems: otherUserItems } = await seed(1, 'other-top-statistics-user');
    const otherUserItem = otherUserItems[0];
    if (!otherUserItem) throw new Error('expected another user vocabulary item');
    await db.insert(event).values([
      ...Array.from({ length: 30 }, () => ({
        userId: 'other-top-statistics-user',
        userVocabularyItemId: otherUserItem.id,
        type: EventType.UserVocabularyItemTaskFailed,
      })),
      ...Array.from({ length: 30 }, () => ({
        userId: 'other-top-statistics-user',
        userVocabularyItemId: otherUserItem.id,
        type: EventType.UserVocabularyItemTaskHintUsed,
      })),
    ]);

    const result = await getStatistics({ userId: USER_ID });

    expect(result.topMistakes).toHaveLength(20);
    expect(result.topMistakes[0]).toMatchObject({ count: 21, value: 'item-20', partOfSpeech: PartOfSpeech.Noun });
    expect(result.topMistakes.at(-1)?.count).toBe(2);
    expect(result.topHintedItems).toHaveLength(20);
    expect(result.topHintedItems[0]).toMatchObject({ count: 21, value: 'item-0', partOfSpeech: PartOfSpeech.Noun });
    expect(result.topHintedItems.at(-1)?.count).toBe(2);
  });
});
