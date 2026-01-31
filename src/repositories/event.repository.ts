import type { AuthParams } from '@/types/auth.types';
import type { Transaction } from '@/types/db.types';
import { EventType, type EventBody } from '@/types/event.types';
import { and, db, eq, Event, gte, isNotNull, lte, sql } from 'astro:db';

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
