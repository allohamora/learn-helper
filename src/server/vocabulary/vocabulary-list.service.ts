import '@tanstack/react-start/server-only';
import { db } from '../db/db.service';
import { Exception } from '../utils/exception.utils';
import { createUserVocabularyItemsFromList } from './user-vocabulary-item.repository';
import { createUserVocabularyList, getUserVocabularyList } from './user-vocabulary-list.repository';
import { getVocabularyListById } from './vocabulary-list.repository';

export const addVocabularyListToUser = async (userId: string, vocabularyListId: string) => {
  return db.transaction(async (tx) => {
    const list = await getVocabularyListById(vocabularyListId, tx);
    if (!list) throw Exception.notFound(`vocabulary list "${vocabularyListId}" not found`);

    const userList = await getUserVocabularyList(userId, vocabularyListId, tx);
    if (userList) throw Exception.conflict(`vocabulary list "${vocabularyListId}" already added`);

    await createUserVocabularyItemsFromList(userId, vocabularyListId, tx);
    return await createUserVocabularyList(userId, vocabularyListId, tx);
  });
};
