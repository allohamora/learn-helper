import '@tanstack/react-start/server-only';
import { EventType } from '@/const/event';
import { LearningStatus, VocabularyListType } from '@/const/vocabulary';
import { db } from '../db/db.service';
import type { Transaction } from '../db/db.types';
import { insertEvent } from '../event/event.repository';
import { Exception } from '../utils/exception.utils';
import {
  createUserVocabularyItem,
  createUserVocabularyItemIfNotExist,
  createUserVocabularyItemsFromList,
  getUserVocabularyItemByIdForUpdate,
  getUserVocabularyItemByVocabularyItemIdForUpdate,
  getUserVocabularyItemWithRelationsByVocabularyItemId,
  newWaitingProgress,
  updateUserVocabularyItemProgress,
} from './user-vocabulary-item.repository';
import {
  createUserVocabularyList,
  getUserPersonalVocabularyListWithRelations,
  getUserVocabularyListById,
  getUserVocabularyListByVocabularyListId,
  getUserVocabularyListWithRelations,
} from './user-vocabulary-list.repository';
import { generateVocabularyItemContent, getVocabularyItemByIdOrThrow } from '../vocabulary/vocabulary-item.service';
import { getVocabularyListByIdOrThrow } from '../vocabulary/vocabulary-list.service';
import {
  createPersonalVocabularyList,
  getPersonalVocabularyListByOwnerId,
} from '../vocabulary/vocabulary-list.repository';
import {
  createVocabularyListItem,
  createVocabularyListItemIfNotExist,
  deleteVocabularyListItem,
  getVocabularyListItem,
} from '../vocabulary/vocabulary-list-item.repository';
import { createVocabularyItemIfNotExist, searchVocabularyItemsForList } from '../vocabulary/vocabulary-item.repository';
import { getUserForUpdateOrThrow } from '../user/user.service';
import type { PersonalVocabularyItemSearchFilterDto } from './dtos/personal-vocabulary-item-search-filter.dto';
import type { GenerateVocabularyItemDto } from '../vocabulary/dtos/generate-vocabulary-item.dto';

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
    if (vocabularyList.type !== VocabularyListType.Public) {
      throw Exception.notFound(`Vocabulary list "${vocabularyListId}" not found`);
    }
    if (userList) throw Exception.conflict(`Vocabulary list "${vocabularyListId}" already added`);

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
  if (!userList) throw Exception.notFound(`Vocabulary list "${userVocabularyListId}" not found for user`);

  return userList;
};

export const getUserVocabularyListWithRelationsOrThrow = async (
  { userId, userVocabularyListId }: { userId: string; userVocabularyListId: string },
  tx: Transaction = db,
) => {
  const userList = await getUserVocabularyListWithRelations({ userId, userVocabularyListId }, tx);
  if (!userList) throw Exception.notFound(`Vocabulary list "${userVocabularyListId}" not found for user`);

  return userList;
};

export const getUserPersonalVocabularyListWithRelationsOrThrow = async (userId: string, tx: Transaction = db) => {
  const userList = await getUserPersonalVocabularyListWithRelations(userId, tx);
  if (!userList) throw Exception.internalServer(`Personal vocabulary list not found for user "${userId}"`);

  return userList;
};

const newLearningProgress = () => ({
  status: LearningStatus.Learning,
  encounterCount: 0,
  enqueuedAt: new Date(),
});

const addUserVocabularyItemInLearningStatus = async (
  {
    userId,
    vocabularyItemId,
    userVocabularyListId,
    isResetToLearning = true,
  }: { userId: string; vocabularyItemId: string; userVocabularyListId: string; isResetToLearning?: boolean },
  tx: Transaction,
) => {
  const createdUserItem = await createUserVocabularyItemIfNotExist(
    { userId, vocabularyItemId, ...newLearningProgress() },
    tx,
  );
  if (createdUserItem) return;
  if (!isResetToLearning) return;

  const existingUserItem = await getUserVocabularyItemByVocabularyItemIdForUpdate({ userId, vocabularyItemId }, tx);
  if (!existingUserItem) {
    throw Exception.internalServer(`Failed to load vocabulary item "${vocabularyItemId}" for reset`);
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
      { userId, userVocabularyItemId: existingUserItem.id, ...newLearningProgress() },
      tx,
    ),
  ]);
};

export const addVocabularyItemToPersonalList = async ({
  userId,
  vocabularyItemId,
  isResetToLearning = true,
}: {
  userId: string;
  vocabularyItemId: string;
  isResetToLearning?: boolean;
}) => {
  return db.transaction(async (tx) => {
    const [{ id: userVocabularyListId, vocabularyList }] = await Promise.all([
      getUserPersonalVocabularyListWithRelationsOrThrow(userId, tx),
      getVocabularyItemByIdOrThrow(vocabularyItemId, tx),
    ]);
    const vocabularyListId = vocabularyList.id;

    const existingListItem = await getVocabularyListItem({ vocabularyListId, vocabularyItemId }, tx);
    if (existingListItem) {
      throw Exception.conflict(`Vocabulary item "${vocabularyItemId}" already in list "${vocabularyListId}"`);
    }

    const createdListItem = await createVocabularyListItemIfNotExist({ vocabularyListId, vocabularyItemId }, tx);
    if (!createdListItem) {
      throw Exception.conflict(`Vocabulary item "${vocabularyItemId}" already in list "${vocabularyListId}"`);
    }

    await addUserVocabularyItemInLearningStatus(
      { userId, vocabularyItemId, userVocabularyListId, isResetToLearning },
      tx,
    );

    const userItem = await getUserVocabularyItemWithRelationsByVocabularyItemId({ userId, vocabularyItemId }, tx);
    if (!userItem) throw Exception.internalServer(`Failed to load vocabulary item "${vocabularyItemId}" after insert`);

    return userItem;
  });
};

export const removeVocabularyItemFromPersonalList = async ({
  userId,
  userVocabularyItemId,
  isReset = false,
}: {
  userId: string;
  userVocabularyItemId: string;
  isReset?: boolean;
}) => {
  return db.transaction(async (tx) => {
    const { id: userVocabularyListId, vocabularyList } = await getUserPersonalVocabularyListWithRelationsOrThrow(
      userId,
      tx,
    );
    const vocabularyListId = vocabularyList.id;

    const userItem = await getUserVocabularyItemByIdForUpdate({ userId, userVocabularyItemId }, tx);
    if (!userItem) throw Exception.notFound(`Vocabulary item "${userVocabularyItemId}" not found for user`);

    const deletedListItem = await deleteVocabularyListItem(
      { vocabularyListId, vocabularyItemId: userItem.vocabularyItemId },
      tx,
    );
    if (!deletedListItem) {
      throw Exception.notFound(`Vocabulary item "${userItem.vocabularyItemId}" not in list "${vocabularyListId}"`);
    }

    await insertEvent(
      {
        type: EventType.UserVocabularyItemRemovedFromList,
        userId,
        userVocabularyItemId,
        vocabularyItemId: userItem.vocabularyItemId,
        userVocabularyListId,
        status: userItem.status,
        encounterCount: userItem.encounterCount,
      },
      tx,
    );

    if (isReset && userItem.status !== LearningStatus.Waiting) {
      await Promise.all([
        insertEvent(
          {
            type: EventType.UserVocabularyItemProgressReset,
            userId,
            userVocabularyItemId,
            userVocabularyListId,
            status: LearningStatus.Waiting,
            encounterCount: userItem.encounterCount,
          },
          tx,
        ),
        updateUserVocabularyItemProgress({ userId, userVocabularyItemId, ...newWaitingProgress() }, tx),
      ]);
    }

    return { userVocabularyItemId };
  });
};

export const generateVocabularyItem = async ({ userId, ...data }: GenerateVocabularyItemDto & { userId: string }) => {
  const { vocabularyList } = await getUserPersonalVocabularyListWithRelationsOrThrow(userId);

  const output = await generateVocabularyItemContent({ userId, ...data });

  return db.transaction(async (tx) => {
    const vocabularyItem = await createVocabularyItemIfNotExist(output, tx);
    if (!vocabularyItem) {
      throw Exception.conflict(
        `Vocabulary item "${output.value}" (${output.partOfSpeech ?? 'no part of speech'}) already exists`,
      );
    }

    await createVocabularyListItem({ vocabularyListId: vocabularyList.id, vocabularyItemId: vocabularyItem.id }, tx);

    const userItem = await createUserVocabularyItem(
      { userId, vocabularyItemId: vocabularyItem.id, ...newLearningProgress() },
      tx,
    );

    return { ...userItem, vocabularyItem };
  });
};

export const searchPersonalVocabularyListItems = async ({
  userId,
  ...filter
}: { userId: string } & PersonalVocabularyItemSearchFilterDto) => {
  const { vocabularyList } = await getUserPersonalVocabularyListWithRelationsOrThrow(userId);

  return searchVocabularyItemsForList({ userId, vocabularyListId: vocabularyList.id, ...filter });
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
