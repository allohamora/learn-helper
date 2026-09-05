import '@tanstack/react-start/server-only';
import { and, eq } from 'drizzle-orm';
import { VocabularyListType } from '@/const/vocabulary';
import { vocabularyList } from '../db/db.schema';
import { db } from '../db/db.service';
import type { Transaction } from '../db/db.types';
import { Exception } from '../utils/exception.utils';

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

export const getPersonalVocabularyListByOwnerId = async (ownerId: string, tx: Transaction = db) => {
  return tx.query.vocabularyList.findFirst({
    where: and(eq(vocabularyList.ownerId, ownerId), eq(vocabularyList.type, VocabularyListType.Personal)),
  });
};

export const createPersonalVocabularyList = async (ownerId: string, tx: Transaction = db) => {
  const [created] = await tx
    .insert(vocabularyList)
    .values({
      ownerId,
      type: VocabularyListType.Personal,
      // every personal list is the same "Personal" concept per user - storing a repeated "Personal"
      // string per row buys nothing; the frontend hardcodes the label off `type` instead
      title: null,
    })
    .returning();
  if (created === undefined) throw Exception.internalServer('Failed to create personal vocabulary list');

  return created;
};
