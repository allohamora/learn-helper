import '@tanstack/react-start/server-only';
import { and, asc, desc, eq, getTableColumns, isNull, or } from 'drizzle-orm';
import { VocabularyListType } from '@/const/vocabulary';
import { userVocabularyList, vocabularyList } from '../db/db.schema';
import { db } from '../db/db.service';
import type { Transaction } from '../db/db.types';
import { Exception } from '../utils/exception.utils';

export const getUserVocabularyListByVocabularyListId = async (
  { userId, vocabularyListId }: { userId: string; vocabularyListId: string },
  tx: Transaction = db,
) => {
  return tx.query.userVocabularyList.findFirst({
    where: and(eq(userVocabularyList.userId, userId), eq(userVocabularyList.vocabularyListId, vocabularyListId)),
  });
};

export const getUserVocabularyListById = async (
  {
    userId,
    userVocabularyListId,
  }: {
    userId: string;
    userVocabularyListId: string;
  },
  tx: Transaction = db,
) => {
  return tx.query.userVocabularyList.findFirst({
    where: and(eq(userVocabularyList.userId, userId), eq(userVocabularyList.id, userVocabularyListId)),
  });
};

export const getUserVocabularyListWithRelations = async (
  {
    userId,
    userVocabularyListId,
  }: {
    userId: string;
    userVocabularyListId: string;
  },
  tx: Transaction = db,
) => {
  return tx.query.userVocabularyList.findFirst({
    where: and(eq(userVocabularyList.userId, userId), eq(userVocabularyList.id, userVocabularyListId)),
    with: { vocabularyList: true },
  });
};

export const getUserPersonalVocabularyListWithRelations = async (userId: string, tx: Transaction = db) => {
  const [row] = await tx
    .select({ ...getTableColumns(userVocabularyList), vocabularyList: getTableColumns(vocabularyList) })
    .from(userVocabularyList)
    .innerJoin(vocabularyList, eq(userVocabularyList.vocabularyListId, vocabularyList.id))
    .where(and(eq(userVocabularyList.userId, userId), eq(vocabularyList.type, VocabularyListType.Personal)))
    .limit(1);

  return row;
};

export const createUserVocabularyList = async (
  { userId, vocabularyListId }: { userId: string; vocabularyListId: string },
  tx: Transaction = db,
) => {
  const [created] = await tx.insert(userVocabularyList).values({ userId, vocabularyListId }).returning();
  if (created === undefined) throw Exception.internalServer('Failed to create user vocabulary list');

  return created;
};

export const getUserAvailableVocabularyLists = async (userId: string) => {
  return db
    .select({
      ...getTableColumns(vocabularyList),
      userVocabularyList,
    })
    .from(vocabularyList)
    .leftJoin(
      userVocabularyList,
      and(eq(userVocabularyList.vocabularyListId, vocabularyList.id), eq(userVocabularyList.userId, userId)),
    )
    .where(or(eq(vocabularyList.type, VocabularyListType.Public), eq(vocabularyList.ownerId, userId)))
    .orderBy(
      desc(eq(vocabularyList.type, VocabularyListType.Personal)),
      asc(isNull(userVocabularyList.id)),
      asc(vocabularyList.createdAt),
    );
};
