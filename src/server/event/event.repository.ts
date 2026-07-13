import '@tanstack/react-start/server-only';
import { and, eq } from 'drizzle-orm';
import { EventType } from '@/const/event';
import { event } from '../db/db.schema';
import { db } from '../db/db.service';
import type { Transaction } from '../db/db.types';

export const insertEvent = async (data: typeof event.$inferInsert, tx: Transaction = db) => {
  await tx.insert(event).values(data);
};

export const deleteUserVocabularyItemDiscoveredEvents = async (
  { userId, userVocabularyItemId }: { userId: string; userVocabularyItemId: string },
  tx: Transaction = db,
) => {
  await tx
    .delete(event)
    .where(
      and(
        eq(event.userId, userId),
        eq(event.userVocabularyItemId, userVocabularyItemId),
        eq(event.type, EventType.UserVocabularyItemDiscovered),
      ),
    );
};
