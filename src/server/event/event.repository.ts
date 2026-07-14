import '@tanstack/react-start/server-only';
import { and, eq, isNull } from 'drizzle-orm';
import { EventType } from '@/const/event';
import { event } from '../db/db.schema';
import { db } from '../db/db.service';
import type { Transaction } from '../db/db.types';

export const insertEvent = async (data: typeof event.$inferInsert, tx: Transaction = db) => {
  await tx.insert(event).values(data);
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
