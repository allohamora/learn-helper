import '@tanstack/react-start/server-only';
import { EventType } from '@/const/event';
import { LearningStatus, VocabularyListType } from '@/const/vocabulary';
import { db } from '../db/db.service';
import type { Transaction } from '../db/db.types';
import { insertEvent } from '../event/event.repository';
import { Exception } from '../utils/exception.utils';
import {
  createUserVocabularyItemIfNotExist,
  createUserVocabularyItemsFromList,
  getUserVocabularyItemByVocabularyItemIdForUpdate,
  getUserVocabularyItemWithRelationsByVocabularyItemId,
  updateUserVocabularyItemProgress,
} from './user-vocabulary-item.repository';
import {
  createUserVocabularyList,
  getUserVocabularyListById,
  getUserVocabularyListByVocabularyListId,
  getUserVocabularyListWithRelations,
} from './user-vocabulary-list.repository';
import { getVocabularyItemByIdOrThrow } from '../vocabulary/vocabulary-item.service';
import { getVocabularyListByIdOrThrow } from '../vocabulary/vocabulary-list.service';
import {
  createPersonalVocabularyList,
  getPersonalVocabularyListByOwnerId,
} from '../vocabulary/vocabulary-list.repository';
import {
  createVocabularyListItemIfNotExist,
  getVocabularyListItem,
} from '../vocabulary/vocabulary-list-item.repository';
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

export const getUserVocabularyListOrThrow = async (
  { userId, userVocabularyListId }: { userId: string; userVocabularyListId: string },
  tx: Transaction = db,
) => {
  const userList = await getUserVocabularyListById({ userId, userVocabularyListId }, tx);
  if (!userList) throw Exception.notFound(`vocabulary list "${userVocabularyListId}" not found for user`);

  return userList;
};

export const getUserVocabularyListWithRelationsOrThrow = async (
  { userId, userVocabularyListId }: { userId: string; userVocabularyListId: string },
  tx: Transaction = db,
) => {
  const userList = await getUserVocabularyListWithRelations({ userId, userVocabularyListId }, tx);
  if (!userList) throw Exception.notFound(`vocabulary list "${userVocabularyListId}" not found for user`);

  return userList;
};

const addUserVocabularyItemInLearningStatus = async (
  {
    userId,
    vocabularyItemId,
    userVocabularyListId,
  }: { userId: string; vocabularyItemId: string; userVocabularyListId: string },
  tx: Transaction,
) => {
  const createdUserItem = await createUserVocabularyItemIfNotExist(
    { userId, vocabularyItemId, status: LearningStatus.Learning, encounterCount: 0, enqueuedAt: new Date() },
    tx,
  );
  if (createdUserItem) return;

  const existingUserItem = await getUserVocabularyItemByVocabularyItemIdForUpdate({ userId, vocabularyItemId }, tx);
  if (!existingUserItem) {
    throw Exception.internalServer(`failed to load vocabulary item "${vocabularyItemId}" for reset`);
  }

  await Promise.all([
    insertEvent(
      {
        type: EventType.UserVocabularyItemProgressReset,
        userId,
        userVocabularyItemId: existingUserItem.id,
        userVocabularyListId,
        status: LearningStatus.Learning,
        encounterCount: existingUserItem.encounterCount,
      },
      tx,
    ),
    updateUserVocabularyItemProgress(
      {
        userId,
        userVocabularyItemId: existingUserItem.id,
        status: LearningStatus.Learning,
        encounterCount: 0,
        enqueuedAt: new Date(),
      },
      tx,
    ),
  ]);
};

export const addVocabularyItemToPersonalList = async ({
  userId,
  userVocabularyListId,
  vocabularyItemId,
}: {
  userId: string;
  userVocabularyListId: string;
  vocabularyItemId: string;
}) => {
  return db.transaction(async (tx) => {
    const [{ vocabularyList }] = await Promise.all([
      getUserVocabularyListWithRelationsOrThrow({ userId, userVocabularyListId }, tx),
      getVocabularyItemByIdOrThrow(vocabularyItemId, tx),
    ]);
    const vocabularyListId = vocabularyList.id;

    if (vocabularyList.type !== VocabularyListType.Personal) {
      throw Exception.forbidden(`vocabulary list "${vocabularyListId}" is not a personal list`);
    }
    if (vocabularyList.ownerId !== userId) {
      throw Exception.forbidden(`vocabulary list "${vocabularyListId}" does not belong to the user`);
    }

    const existingListItem = await getVocabularyListItem({ vocabularyListId, vocabularyItemId }, tx);
    if (existingListItem) {
      throw Exception.conflict(`vocabulary item "${vocabularyItemId}" already in list "${vocabularyListId}"`);
    }

    const createdListItem = await createVocabularyListItemIfNotExist({ vocabularyListId, vocabularyItemId }, tx);
    if (!createdListItem) {
      throw Exception.conflict(`vocabulary item "${vocabularyItemId}" already in list "${vocabularyListId}"`);
    }

    await addUserVocabularyItemInLearningStatus({ userId, vocabularyItemId, userVocabularyListId }, tx);

    const userItem = await getUserVocabularyItemWithRelationsByVocabularyItemId({ userId, vocabularyItemId }, tx);
    if (!userItem) throw Exception.internalServer(`failed to load vocabulary item "${vocabularyItemId}" after insert`);

    return userItem;
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
