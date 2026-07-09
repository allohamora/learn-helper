import '@tanstack/react-start/server-only';
import { vocabularyItem } from '../db/db.schema';
import { db } from '../db/db.service';

// inserts rows not already present (matched by value + partOfSpeech); returns only the newly inserted rows
export const createMissingVocabularyItems = async (values: (typeof vocabularyItem.$inferInsert)[]) => {
  if (values.length === 0) return [];

  return await db
    .insert(vocabularyItem)
    .values(values)
    .onConflictDoNothing({ target: [vocabularyItem.value, vocabularyItem.partOfSpeech] })
    .returning();
};
