import '@tanstack/react-start/server-only';
import { and, asc, eq, isNull } from 'drizzle-orm';
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

export const getUserVocabularyListOrThrow = async (
  {
    userId,
    userVocabularyListId,
  }: {
    userId: string;
    userVocabularyListId: string;
  },
  tx: Transaction = db,
) => {
  const userList = await getUserVocabularyListById({ userId, userVocabularyListId }, tx);
  if (!userList) throw Exception.notFound(`vocabulary list "${userVocabularyListId}" not found for user`);

  return userList;
};

export const createUserVocabularyList = async (
  { userId, vocabularyListId }: { userId: string; vocabularyListId: string },
  tx: Transaction = db,
) => {
  const [created] = await tx.insert(userVocabularyList).values({ userId, vocabularyListId }).returning();

  return created;
};

export const getUserAvailableVocabularyLists = async (userId: string) => {
  return db
    .select({
      id: userVocabularyList.id,
      vocabularyListId: vocabularyList.id,
      title: vocabularyList.title,
      addedAt: userVocabularyList.createdAt,
    })
    .from(vocabularyList)
    .leftJoin(
      userVocabularyList,
      and(eq(userVocabularyList.vocabularyListId, vocabularyList.id), eq(userVocabularyList.userId, userId)),
    )
    .orderBy(asc(isNull(userVocabularyList.id)), asc(vocabularyList.createdAt));
};
