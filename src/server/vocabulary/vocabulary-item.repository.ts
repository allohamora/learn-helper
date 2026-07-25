import '@tanstack/react-start/server-only';
import { eq } from 'drizzle-orm';
import { vocabularyItem } from '../db/db.schema';
import { db } from '../db/db.service';
import type { Transaction } from '../db/db.types';

// inserts rows not already present (matched by value + partOfSpeech); returns only the newly inserted rows
export const createMissingVocabularyItems = async (values: (typeof vocabularyItem.$inferInsert)[]) => {
  if (values.length === 0) return [];

  return await db
    .insert(vocabularyItem)
    .values(values)
    .onConflictDoNothing({ target: [vocabularyItem.value, vocabularyItem.partOfSpeech] })
    .returning();
};

export const updateVocabularyItemTranslation = async (
  { vocabularyItemId, uaTranslation }: { vocabularyItemId: string; uaTranslation: string },
  tx: Transaction = db,
) => {
  await tx.update(vocabularyItem).set({ uaTranslation }).where(eq(vocabularyItem.id, vocabularyItemId));
};
