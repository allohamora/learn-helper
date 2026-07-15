import '@tanstack/react-start/server-only';
import { db } from '../db/db.service';
import type { Transaction } from '../db/db.types';
import { Exception } from '../utils/exception.utils';
import { createUserVocabularyItemsFromList } from './user-vocabulary-item.repository';
import {
  createUserVocabularyList,
  getUserVocabularyListById,
  getUserVocabularyListByVocabularyListId,
  getUserVocabularyListWithList,
} from './user-vocabulary-list.repository';
import { getVocabularyListByIdOrThrow } from '../vocabulary/vocabulary-list.service';

export const addVocabularyListToUser = async ({
  userId,
  vocabularyListId,
}: {
  userId: string;
  vocabularyListId: string;
}) => {
  return db.transaction(async (tx) => {
    const vocabularyList = await getVocabularyListByIdOrThrow(vocabularyListId, tx);

    const userList = await getUserVocabularyListByVocabularyListId({ userId, vocabularyListId }, tx);
    if (userList) throw Exception.conflict(`vocabulary list "${vocabularyListId}" already added`);

    await createUserVocabularyItemsFromList({ userId, vocabularyListId }, tx);
    const created = await createUserVocabularyList({ userId, vocabularyListId }, tx);

    return { ...created, vocabularyList };
  });
};

export const getUserVocabularyListOrThrow = async (
  { userId, userVocabularyListId }: { userId: string; userVocabularyListId: string },
  tx: Transaction = db,
) => {
  const userList = await getUserVocabularyListById({ userId, userVocabularyListId }, tx);
  if (!userList) throw Exception.notFound(`vocabulary list "${userVocabularyListId}" not found for user`);

  return userList;
};

export const getUserVocabularyListWithListOrThrow = async ({
  userId,
  userVocabularyListId,
}: {
  userId: string;
  userVocabularyListId: string;
}) => {
  const userList = await getUserVocabularyListWithList({ userId, userVocabularyListId });
  if (!userList) throw Exception.notFound(`vocabulary list "${userVocabularyListId}" not found for user`);

  return userList;
};
