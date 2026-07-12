import '@tanstack/react-start/server-only';
import { db } from '../db/db.service';
import { Exception } from '../utils/exception.utils';
import { createUserVocabularyItemsFromList } from './user-vocabulary-item.repository';
import {
  createUserVocabularyList,
  getUserAvailableVocabularyLists as getUserAvailableVocabularyListsFromRepository,
  getUserVocabularyListByVocabularyListId,
} from './user-vocabulary-list.repository';
import { getVocabularyListByIdOrThrow } from '../vocabulary/vocabulary-list.repository';

export const getUserAvailableVocabularyLists = async (userId: string) => {
  return getUserAvailableVocabularyListsFromRepository(userId);
};

export const addVocabularyListToUser = async ({
  userId,
  vocabularyListId,
}: {
  userId: string;
  vocabularyListId: string;
}) => {
  return db.transaction(async (tx) => {
    await getVocabularyListByIdOrThrow(vocabularyListId, tx);

    const userList = await getUserVocabularyListByVocabularyListId({ userId, vocabularyListId }, tx);
    if (userList) throw Exception.conflict(`vocabulary list "${vocabularyListId}" already added`);

    await createUserVocabularyItemsFromList({ userId, vocabularyListId }, tx);
    return await createUserVocabularyList({ userId, vocabularyListId }, tx);
  });
};
