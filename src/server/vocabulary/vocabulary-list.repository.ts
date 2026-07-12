import '@tanstack/react-start/server-only';
import { eq } from 'drizzle-orm';
import { vocabularyList } from '../db/db.schema';
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

export const getVocabularyListById = async (vocabularyListId: string, tx: Transaction = db) => {
  return tx.query.vocabularyList.findFirst({ where: eq(vocabularyList.id, vocabularyListId) });
};

export const getVocabularyListByIdOrThrow = async (vocabularyListId: string, tx: Transaction = db) => {
  const list = await getVocabularyListById(vocabularyListId, tx);
  if (!list) throw Exception.notFound(`vocabulary list "${vocabularyListId}" not found`);

  return list;
};
