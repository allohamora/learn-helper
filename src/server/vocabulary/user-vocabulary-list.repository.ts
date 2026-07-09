import '@tanstack/react-start/server-only';
import { and, eq } from 'drizzle-orm';
import { userVocabularyList } from '../db/db.schema';
import { db } from '../db/db.service';
import type { Transaction } from '../db/db.types';

export const getUserVocabularyList = async (userId: string, vocabularyListId: string, tx: Transaction = db) => {
  return tx.query.userVocabularyList.findFirst({
    where: and(eq(userVocabularyList.userId, userId), eq(userVocabularyList.vocabularyListId, vocabularyListId)),
  });
};

export const createUserVocabularyList = async (userId: string, vocabularyListId: string, tx: Transaction = db) => {
  const [created] = await tx.insert(userVocabularyList).values({ userId, vocabularyListId }).returning();

  return created;
};
