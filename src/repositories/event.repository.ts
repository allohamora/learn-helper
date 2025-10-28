import type { AuthParams } from '@/types/auth.types';
import type { Transaction } from '@/types/db.types';
import { EventType, type DiscoveryStatus, type EventBody } from '@/types/user-words.types';
import { and, db, eq, Event, gte, isNotNull, lte, sql, UserWord, Word } from 'astro:db';

export const insertEvents = async (data: AuthParams<EventBody>[], tx: Transaction = db) => {
  await tx.insert(Event).values(data);
};

export const insertEvent = async (data: AuthParams<EventBody>, tx: Transaction = db) => {
  await insertEvents([data], tx);
};

export const deleteDiscoveryWordStatusChangedEvents = async (
  { userId, userWordId }: AuthParams<{ userWordId: number }>,
  tx: Transaction = db,
) => {
  await tx
    .delete(Event)
    .where(
      and(
        eq(Event.userId, userId),
        eq(Event.userWordId, userWordId),
        eq(Event.type, EventType.DiscoveryWordStatusChanged),
      ),
    );
};

export const getTypeStatistics = async ({ userId }: AuthParams) => {
  return await db
    .select({ count: sql<number>`count(*)`, duration: sql<number>`SUM(${Event.data}->>'duration')`, type: Event.type })
    .from(Event)
    .where(eq(Event.userId, userId))
    .groupBy(Event.type);
};

export const getDurationPerDayStatistics = async ({
  userId,
  dateFrom,
  dateTo,
}: AuthParams<{ dateFrom: Date; dateTo: Date }>) => {
  return await db
    .select({
      count: sql<number>`count(*)`,
      date: sql<string>`date(${Event.createdAt})`,
      duration: sql<number>`SUM(${Event.data}->>'duration')`,
    })
    .from(Event)
    .where(
      and(
        eq(Event.userId, userId),
        eq(Event.type, EventType.LearningSessionCompleted),
        and(gte(Event.createdAt, dateFrom), lte(Event.createdAt, dateTo)),
      ),
    )
    .groupBy(Event.type, sql`date(${Event.createdAt})`);
};

export const getDiscoveryPerDayStatistics = async ({
  userId,
  dateFrom,
  dateTo,
}: AuthParams<{ dateFrom: Date; dateTo: Date }>) => {
  return await db
    .select({
      count: sql<number>`count(*)`,
      date: sql<string>`date(${Event.createdAt})`,
      status: sql<DiscoveryStatus>`${Event.data}->>'status'`,
    })
    .from(Event)
    .where(
      and(
        eq(Event.userId, userId),
        isNotNull(Event.userWordId),
        eq(Event.type, EventType.DiscoveryWordStatusChanged),
        and(gte(Event.createdAt, dateFrom), lte(Event.createdAt, dateTo)),
      ),
    )
    .groupBy(sql`${Event.data}->>'status'`, sql`date(${Event.createdAt})`);
};

export const getTopMistakes = async ({ userId }: AuthParams) => {
  return await db
    .select({ count: sql<number>`count(*)`, value: Word.value, partOfSpeech: Word.partOfSpeech })
    .from(Event)
    .where(and(eq(Event.userId, userId), isNotNull(Event.userWordId), eq(Event.type, EventType.LearningMistakeMade)))
    .groupBy(Event.userWordId)
    .leftJoin(UserWord, eq(Event.userWordId, UserWord.id))
    .leftJoin(Word, eq(UserWord.wordId, Word.id))
    .limit(20);
};
