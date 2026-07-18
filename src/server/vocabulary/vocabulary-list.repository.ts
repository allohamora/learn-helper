import '@tanstack/react-start/server-only';
import { eq } from 'drizzle-orm';
import { vocabularyList } from '../db/db.schema';
import { db } from '../db/db.service';
import type { Transaction } from '../db/db.types';

export const insertVocabularyListIgnoringConflict = async (title: string) => {
  const [inserted] = await db
    .insert(vocabularyList)
    .values({ title })
    .onConflictDoNothing({ target: vocabularyList.title })
    .returning();

  return inserted;
};

export const getVocabularyListByTitle = async (title: string) => {
  return db.query.vocabularyList.findFirst({ where: eq(vocabularyList.title, title) });
};

export const getVocabularyListById = async (vocabularyListId: string, tx: Transaction = db) => {
  return tx.query.vocabularyList.findFirst({ where: eq(vocabularyList.id, vocabularyListId) });
};
