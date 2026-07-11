import '@tanstack/react-start/server-only';
import { db } from '../db/db.service';
import type { Transaction } from '../db/db.types';
import { Exception } from '../utils/exception.utils';
import { createUserVocabularyItemsFromList } from './user-vocabulary-item.repository';
import { createUserVocabularyList, getUserVocabularyList } from './user-vocabulary-list.repository';
import { getVocabularyListById } from './vocabulary-list.repository';

export const addVocabularyListToUser = async (userId: string, vocabularyListId: string) => {
  return db.transaction(async (tx) => {
    await getVocabularyListByIdOrThrow(vocabularyListId, tx);

    const userList = await getUserVocabularyList(userId, vocabularyListId, tx);
    if (userList) throw Exception.conflict(`vocabulary list "${vocabularyListId}" already added`);

    await createUserVocabularyItemsFromList(userId, vocabularyListId, tx);
    return await createUserVocabularyList(userId, vocabularyListId, tx);
  });
};

export const getUserVocabularyListOrThrow = async (userId: string, vocabularyListId: string, tx: Transaction = db) => {
  const userList = await getUserVocabularyList(userId, vocabularyListId, tx);
  if (!userList) throw Exception.notFound(`vocabulary list "${vocabularyListId}" not found for user`);

  return userList;
};

export const getVocabularyListByIdOrThrow = async (vocabularyListId: string, tx: Transaction = db) => {
  const list = await getVocabularyListById(vocabularyListId, tx);
  if (!list) throw Exception.notFound(`vocabulary list "${vocabularyListId}" not found`);

  return list;
};
