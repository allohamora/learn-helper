import '@tanstack/react-start/server-only';
import { db } from '../db/db.service';
import type { Transaction } from '../db/db.types';
import { Exception } from '../utils/exception.utils';
import { createUserVocabularyItemsFromList } from './user-vocabulary-item.repository';
import {
  createUserVocabularyList,
  getUserVocabularyListById,
  getUserVocabularyListByVocabularyListId,
  getUserVocabularyListWithRelations,
} from './user-vocabulary-list.repository';
import { getVocabularyListByIdOrThrow } from '../vocabulary/vocabulary-list.service';
import {
  createPersonalVocabularyList,
  getPersonalVocabularyListByOwnerId,
} from '../vocabulary/vocabulary-list.repository';
import { getUserForUpdateOrThrow } from '../user/user.service';

export const addVocabularyListToUser = async ({
  userId,
  vocabularyListId,
}: {
  userId: string;
  vocabularyListId: string;
}) => {
  return db.transaction(async (tx) => {
    const [vocabularyList, userList] = await Promise.all([
      getVocabularyListByIdOrThrow(vocabularyListId, tx),
      getUserVocabularyListByVocabularyListId({ userId, vocabularyListId }, tx),
    ]);
    if (userList) throw Exception.conflict(`vocabulary list "${vocabularyListId}" already added`);

    const [, created] = await Promise.all([
      createUserVocabularyItemsFromList({ userId, vocabularyListId }, tx),
      createUserVocabularyList({ userId, vocabularyListId }, tx),
    ]);

    return { ...created, vocabularyList };
  });
};

export const createPersonalVocabularyListForUser = async (userId: string) => {
  return db.transaction(async (tx) => {
    // serializes concurrent calls for the same user so they queue instead of racing on the
    // personal-list INSERT below. Locking the personal list row itself wouldn't help here - it
    // only exists to lock once created, and the race we care about is exactly the case where it
    // doesn't exist yet. The user row always exists, which is what makes it lockable regardless.
    await getUserForUpdateOrThrow(userId, tx);

    const existing = await getPersonalVocabularyListByOwnerId(userId, tx);
    if (existing) return existing;

    const list = await createPersonalVocabularyList(userId, tx);

    const existingEnrollment = await getUserVocabularyListByVocabularyListId({ userId, vocabularyListId: list.id }, tx);
    if (!existingEnrollment) {
      await createUserVocabularyList({ userId, vocabularyListId: list.id }, tx);
    }

    return list;
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

export const getUserVocabularyListWithRelationsOrThrow = async ({
  userId,
  userVocabularyListId,
}: {
  userId: string;
  userVocabularyListId: string;
}) => {
  const userList = await getUserVocabularyListWithRelations({ userId, userVocabularyListId });
  if (!userList) throw Exception.notFound(`vocabulary list "${userVocabularyListId}" not found for user`);

  return userList;
};
