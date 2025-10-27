import type { AuthParams } from '@/types/auth.types';
import type { Transaction } from '@/types/db.types';
import { EventType, type EventBody } from '@/types/user-words.types';
import { and, db, eq, Event } from 'astro:db';

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
