import '@tanstack/react-start/server-only';
import { and, count, desc, eq, gte, inArray, isNotNull, isNull, lte, sql, sum } from 'drizzle-orm';
import { EventType } from '@/const/event';
import { event, userVocabularyItem, vocabularyItem } from '../db/db.schema';
import { db } from '../db/db.service';
import type { Transaction } from '../db/db.types';

export const insertEvent = async (data: typeof event.$inferInsert, tx: Transaction = db) => {
  await tx.insert(event).values(data);
};

export const insertEvents = async (data: (typeof event.$inferInsert)[], tx: Transaction = db) => {
  return await tx.insert(event).values(data).returning();
};

// part of the reading-time-spent hourly bucketing (see reading.service.ts): updates the reading's
// event in place when its latest flush falls in the current clock hour, accumulating duration_ms and
// refreshing metadata. Returns undefined when no such row exists (none yet, or it's from a past hour) -
// the caller falls back to insertEvent in that case, so a new bucket starts.
export const updateCurrentHourReadingTimeSpentEvent = async (
  {
    userId,
    readingId,
    addDurationMs,
    currentPage,
  }: { userId: string; readingId: string; addDurationMs: number; currentPage: number },
  tx: Transaction = db,
) => {
  const now = new Date();

  const [updated] = await tx
    .update(event)
    .set({ durationMs: sql`${event.durationMs} + ${addDurationMs}`, metadata: { currentPage }, lastFlushedAt: now })
    .where(
      and(
        eq(event.userId, userId),
        eq(event.readingId, readingId),
        eq(event.type, EventType.ReadingTimeSpent),
        sql`date_trunc('hour', ${event.createdAt}) = date_trunc('hour', ${now.toISOString()}::timestamptz)`,
      ),
    )
    .returning();

  return updated;
};

export const revertUserVocabularyItemDiscoveredEvent = async (
  { userId, userVocabularyItemId }: { userId: string; userVocabularyItemId: string },
  tx: Transaction = db,
) => {
  const [reverted] = await tx
    .update(event)
    .set({ revertedAt: new Date() })
    .where(
      and(
        eq(event.userId, userId),
        eq(event.userVocabularyItemId, userVocabularyItemId),
        eq(event.type, EventType.UserVocabularyItemDiscovered),
        isNull(event.revertedAt),
      ),
    )
    .returning();

  return reverted;
};

export const getEventsGroupedByType = async ({ userId }: { userId: string }) => {
  return await db
    .select({
      type: event.type,
      count: count(),
      durationMs: sum(event.durationMs).mapWith(Number),
      costInNanoDollars: sum(event.costInNanoDollars).mapWith(Number),
      inputTokens: sum(event.inputTokens).mapWith(Number),
      outputTokens: sum(event.outputTokens).mapWith(Number),
    })
    .from(event)
    .where(eq(event.userId, userId))
    .groupBy(event.type);
};

type DailyEventStatisticsDto = {
  userId: string;
  dateFrom: Date;
  dateTo: Date;
  timezone: string;
};

export const getDiscoveryEventsGroupedByDay = async ({
  userId,
  dateFrom,
  dateTo,
  timezone,
}: DailyEventStatisticsDto) => {
  const date = sql<string>`date(${event.createdAt} AT TIME ZONE ${timezone})`.as('date');

  return await db
    .select({
      count: count(),
      date,
      durationMs: sum(event.durationMs).mapWith(Number),
      status: event.status,
    })
    .from(event)
    .where(
      and(
        eq(event.userId, userId),
        eq(event.type, EventType.UserVocabularyItemDiscovered),
        gte(event.createdAt, dateFrom),
        lte(event.createdAt, dateTo),
      ),
    )
    .groupBy(event.status, date);
};

export const getLearningEventsGroupedByDay = async ({
  userId,
  dateFrom,
  dateTo,
  timezone,
}: DailyEventStatisticsDto) => {
  const date = sql<string>`date(${event.createdAt} AT TIME ZONE ${timezone})`.as('date');

  return await db
    .select({
      type: event.type,
      count: count(),
      date,
      durationMs: sum(event.durationMs).mapWith(Number),
    })
    .from(event)
    .where(
      and(
        eq(event.userId, userId),
        inArray(event.type, [
          EventType.UserVocabularyItemTaskFailed,
          EventType.UserVocabularyItemTaskPassed,
          EventType.UserVocabularyItemTaskRetryPassed,
          EventType.UserVocabularyItemTaskShowcaseViewed,
          EventType.UserVocabularyItemTaskHintUsed,
        ]),
        gte(event.createdAt, dateFrom),
        lte(event.createdAt, dateTo),
      ),
    )
    .groupBy(event.type, date);
};

export const getReadingEventsGroupedByDay = async ({ userId, dateFrom, dateTo, timezone }: DailyEventStatisticsDto) => {
  const date = sql<string>`date(${event.createdAt} AT TIME ZONE ${timezone})`.as('date');

  return await db
    .select({
      type: event.type,
      count: count(),
      date,
      durationMs: sum(event.durationMs).mapWith(Number),
    })
    .from(event)
    .where(
      and(
        eq(event.userId, userId),
        inArray(event.type, [EventType.ReadingTimeSpent, EventType.ReadingSelectionTranslationGenerated]),
        gte(event.createdAt, dateFrom),
        lte(event.createdAt, dateTo),
      ),
    )
    .groupBy(event.type, date);
};

export const getCostEventsGroupedByDay = async ({ userId, dateFrom, dateTo, timezone }: DailyEventStatisticsDto) => {
  const date = sql<string>`date(${event.createdAt} AT TIME ZONE ${timezone})`.as('date');

  return await db
    .select({
      date,
      costInNanoDollars: sum(event.costInNanoDollars).mapWith(Number),
      inputTokens: sum(event.inputTokens).mapWith(Number),
      outputTokens: sum(event.outputTokens).mapWith(Number),
    })
    .from(event)
    .where(
      and(
        eq(event.userId, userId),
        inArray(event.type, [
          EventType.UserVocabularyItemTaskGenerated,
          EventType.VocabularyItemGenerated,
          EventType.ReadingSelectionTranslationGenerated,
        ]),
        gte(event.createdAt, dateFrom),
        lte(event.createdAt, dateTo),
      ),
    )
    .groupBy(date);
};

export const getVocabularyItemUpdatedEventsGroupedByDay = async ({
  userId,
  dateFrom,
  dateTo,
  timezone,
}: DailyEventStatisticsDto) => {
  const date = sql<string>`date(${event.createdAt} AT TIME ZONE ${timezone})`.as('date');

  return await db
    .select({
      date,
      fieldName: event.fieldName,
      count: count(),
    })
    .from(event)
    .where(
      and(
        eq(event.userId, userId),
        eq(event.type, EventType.VocabularyItemUpdated),
        isNotNull(event.fieldName),
        gte(event.createdAt, dateFrom),
        lte(event.createdAt, dateTo),
      ),
    )
    .groupBy(event.fieldName, date);
};

const getTopVocabularyItemsByEventType = async ({
  userId,
  type,
  limit,
}: {
  userId: string;
  type: EventType;
  limit: number;
}) => {
  return await db
    .select({
      count: count(),
      value: vocabularyItem.value,
      partOfSpeech: vocabularyItem.partOfSpeech,
    })
    .from(event)
    .innerJoin(userVocabularyItem, eq(event.userVocabularyItemId, userVocabularyItem.id))
    .innerJoin(vocabularyItem, eq(userVocabularyItem.vocabularyItemId, vocabularyItem.id))
    .where(and(eq(event.userId, userId), eq(event.type, type), isNotNull(event.userVocabularyItemId)))
    .groupBy(event.userVocabularyItemId, vocabularyItem.id)
    .orderBy(desc(count()))
    .limit(limit);
};

export const getTopMistakes = async ({ userId, limit }: { userId: string; limit: number }) => {
  return await getTopVocabularyItemsByEventType({
    userId,
    limit,
    type: EventType.UserVocabularyItemTaskFailed,
  });
};

export const getTopHintedVocabularyItems = async ({ userId, limit }: { userId: string; limit: number }) => {
  return await getTopVocabularyItemsByEventType({
    userId,
    limit,
    type: EventType.UserVocabularyItemTaskHintUsed,
  });
};
