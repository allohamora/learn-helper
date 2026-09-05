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

// part of the reading-time-spent hourly bucketing (see reading.service.ts): merges into the reading's
// event for the current clock hour, accumulating duration_ms and refreshing metadata, or starts a new
// bucket if none exists yet (or the existing one is from a past hour). A single atomic upsert against
// event_reading_time_spent_hourly_bucket_idx (db.schema.ts, keyed off hourBucket), rather than a
// separate update + fallback insert, so two concurrent first-flushes for the same hour can't both
// insert a row.
export const upsertCurrentHourReadingTimeSpentEvent = async (
  {
    userId,
    readingId,
    addDurationMs,
    currentPage,
  }: { userId: string; readingId: string; addDurationMs: number; currentPage: number },
  tx: Transaction = db,
) => {
  const [upserted] = await tx
    .insert(event)
    .values({
      userId,
      readingId,
      type: EventType.ReadingTimeSpent,
      durationMs: addDurationMs,
      metadata: { currentPage },
      // The DB's own clock, not the app server's, so it can't drift - see hourBucket (db.schema.ts).
      // 'UTC' keeps bucketing consistent regardless of the connection's session timezone setting.
      hourBucket: sql`date_trunc('hour', now(), 'UTC')`,
    })
    .onConflictDoUpdate({
      target: [event.userId, event.readingId, event.hourBucket],
      set: {
        durationMs: sql`${event.durationMs} + ${addDurationMs}`,
        metadata: { currentPage },
        lastFlushedAt: sql`clock_timestamp()`,
      },
    })
    .returning();

  if (upserted === undefined) throw new Error('Failed to upsert reading-time-spent event');

  return upserted;
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
