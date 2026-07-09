import { and, asc, eq } from 'drizzle-orm';
import { userVocabularyList, vocabularyList } from '../db/db.schema';
import { db } from '../db/db.service';
import type { Transaction } from '../db/db.types';
import { Exception } from '../utils/exception.utils';

export const findOrCreateVocabularyListByTitle = async (title: string) => {
  const [inserted] = await db
    .insert(vocabularyList)
    .values({ title })
    .onConflictDoNothing({ target: vocabularyList.title })
    .returning();
  if (inserted) return inserted;

  const existing = await db.query.vocabularyList.findFirst({ where: eq(vocabularyList.title, title) });
  if (!existing) throw Exception.internalServer(`failed to find or create vocabulary list "${title}"`);

  return existing;
};

export const getVocabularyListById = async (id: string, tx: Transaction = db) => {
  return tx.query.vocabularyList.findFirst({ where: eq(vocabularyList.id, id) });
};

export const getVocabularyListsForUser = async (userId: string) => {
  return db
    .select({
      id: vocabularyList.id,
      title: vocabularyList.title,
      addedAt: userVocabularyList.createdAt,
    })
    .from(vocabularyList)
    .leftJoin(
      userVocabularyList,
      and(eq(userVocabularyList.vocabularyListId, vocabularyList.id), eq(userVocabularyList.userId, userId)),
    )
    .orderBy(asc(userVocabularyList.createdAt));
};
