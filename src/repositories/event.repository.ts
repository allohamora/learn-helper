import type { AuthParams } from '@/types/auth.types';
import type { Transaction } from '@/types/db.types';
import { EventType, type EventBody } from '@/types/event.types';
import { and, db, eq, Event, gte, inArray, isNotNull, lte, sql, UserWord, Word } from 'astro:db';

export const insertEvents = async (data: AuthParams<EventBody>[], tx: Transaction = db) => {
  await tx.insert(Event).values(data);
};

export const insertEvent = async (data: AuthParams<EventBody>, tx: Transaction = db) => {
  await insertEvents([data], tx);
};

export const deleteWordDiscoveredEvents = async (
  { userId, userWordId }: AuthParams<{ userWordId: number }>,
  tx: Transaction = db,
) => {
  await tx
    .delete(Event)
    .where(and(eq(Event.userId, userId), eq(Event.userWordId, userWordId), eq(Event.type, EventType.WordDiscovered)));
};

export const getGroupedByTypeEvents = async ({ userId }: AuthParams) => {
  return await db
    .select({
      count: sql<number>`count(*)`,
      durationMs: sql<number | null>`SUM(${Event.durationMs})`,
      costInNanoDollars: sql<number | null>`SUM(${Event.costInNanoDollars})`,
      inputTokens: sql<number | null>`SUM(${Event.inputTokens})`,
      outputTokens: sql<number | null>`SUM(${Event.outputTokens})`,
      type: Event.type,
    })
    .from(Event)
    .where(eq(Event.userId, userId))
    .groupBy(Event.type);
};

export const getGroupedByDayDiscoveryEvents = async ({
  userId,
  dateFrom,
  dateTo,
}: AuthParams<{ dateFrom: Date; dateTo: Date }>) => {
  return await db
    .select({
      count: sql<number>`count(*)`,
      date: sql<string>`date(${Event.createdAt})`,
      durationMs: sql<number | null>`SUM(${Event.durationMs})`,
      status: Event.status,
    })
    .from(Event)
    .where(
      and(
        eq(Event.userId, userId),
        isNotNull(Event.userWordId),
        eq(Event.type, EventType.WordDiscovered),
        and(gte(Event.createdAt, dateFrom), lte(Event.createdAt, dateTo)),
      ),
    )
    .groupBy(Event.status, sql`date(${Event.createdAt})`);
};

export const getGroupedByDayLearningEvents = async ({
  userId,
  dateFrom,
  dateTo,
}: AuthParams<{ dateFrom: Date; dateTo: Date }>) => {
  return await db
    .select({
      type: Event.type,
      count: sql<number>`count(*)`,
      date: sql<string>`date(${Event.createdAt})`,
      durationMs: sql<number | null>`SUM(${Event.durationMs})`,
    })
    .from(Event)
    .where(
      and(
        eq(Event.userId, userId),
        inArray(Event.type, [
          EventType.LearningMistakeMade,
          EventType.LearningTaskCompleted,
          EventType.ShowcaseTaskCompleted,
          EventType.RetryLearningTaskCompleted,
          EventType.HintViewed,
        ]),
        and(gte(Event.createdAt, dateFrom), lte(Event.createdAt, dateTo)),
      ),
    )
    .groupBy(Event.type, sql`date(${Event.createdAt})`);
};

export const getGroupedByDayTaskCostEvents = async ({
  userId,
  dateFrom,
  dateTo,
}: AuthParams<{ dateFrom: Date; dateTo: Date }>) => {
  return await db
    .select({
      date: sql<string>`date(${Event.createdAt})`,
      costInNanoDollars: sql<number | null>`SUM(${Event.costInNanoDollars})`,
      inputTokens: sql<number | null>`SUM(${Event.inputTokens})`,
      outputTokens: sql<number | null>`SUM(${Event.outputTokens})`,
    })
    .from(Event)
    .where(
      and(
        eq(Event.userId, userId),
        eq(Event.type, EventType.TaskCost),
        and(gte(Event.createdAt, dateFrom), lte(Event.createdAt, dateTo)),
      ),
    )
    .groupBy(sql`date(${Event.createdAt})`);
};

export const getGroupedByDayUaTranslationUpdatedEvents = async ({
  userId,
  dateFrom,
  dateTo,
}: AuthParams<{ dateFrom: Date; dateTo: Date }>) => {
  return await db
    .select({
      date: sql<string>`date(${Event.createdAt})`,
      count: sql<number>`count(*)`,
    })
    .from(Event)
    .where(
      and(
        eq(Event.userId, userId),
        eq(Event.type, EventType.UaTranslationUpdated),
        and(gte(Event.createdAt, dateFrom), lte(Event.createdAt, dateTo)),
      ),
    )
    .groupBy(sql`date(${Event.createdAt})`);
};

export const getTopMistakes = async ({ userId, limit }: AuthParams<{ limit: number }>) => {
  return await db
    .select({ count: sql<number>`count(*)`, value: Word.value, partOfSpeech: Word.partOfSpeech })
    .from(Event)
    .where(and(eq(Event.userId, userId), isNotNull(Event.userWordId), eq(Event.type, EventType.LearningMistakeMade)))
    .groupBy(Event.userWordId)
    .leftJoin(UserWord, eq(Event.userWordId, UserWord.id))
    .leftJoin(Word, eq(UserWord.wordId, Word.id))
    .orderBy(sql`count(*) DESC`)
    .limit(limit);
};

export const getTopHintedWords = async ({ userId, limit }: AuthParams<{ limit: number }>) => {
  return await db
    .select({ count: sql<number>`count(*)`, value: Word.value, partOfSpeech: Word.partOfSpeech })
    .from(Event)
    .where(and(eq(Event.userId, userId), isNotNull(Event.userWordId), eq(Event.type, EventType.HintViewed)))
    .groupBy(Event.userWordId)
    .leftJoin(UserWord, eq(Event.userWordId, UserWord.id))
    .leftJoin(Word, eq(UserWord.wordId, Word.id))
    .orderBy(sql`count(*) DESC`)
    .limit(limit);
};
