import '@tanstack/react-start/server-only';
import { EventType } from '@/const/event';
import { LearningStatus } from '@/const/vocabulary';
import { updateVocabularyItemTranslation } from '../vocabulary/vocabulary-item.repository';
import { db } from '../db/db.service';
import type { Transaction } from '../db/db.types';
import { insertEvent, insertEvents, revertUserVocabularyItemDiscoveredEvent } from '../event/event.repository';
import { Exception } from '../utils/exception.utils';
import { unique } from '../utils/array.utils';
import { getVocabularyListItemsByVocabularyItemIds } from '../vocabulary/vocabulary-list-item.repository';
import { getVocabularyListItemOrThrow } from '../vocabulary/vocabulary-list-item.service';
import type { CreateVocabularyListLearnEventsDto } from './dtos/create-vocabulary-list-learn-events.dto';
import type { DiscoverUserVocabularyItemDto } from './dtos/discover-user-vocabulary-item.dto';
import type { UpdateUserVocabularyItemTranslationDto } from './dtos/update-user-vocabulary-item-translation.dto';
import type { UserVocabularyListItemsFilterDto } from './dtos/user-vocabulary-list-items-filter.dto';
import {
  getNewItems,
  getReviewItems,
  getUserVocabularyItemById,
  getUserVocabularyItemWithRelationsById,
  getUserVocabularyItemByIdForUpdate,
  getUserVocabularyItemsByIds,
  getUserVocabularyListItems as getUserVocabularyListItemsFromRepository,
  getUserVocabularyListItemStatusCounts,
  newWaitingProgress,
  updateUserVocabularyItemProgress,
  updateUserVocabularyItemStatus,
} from './user-vocabulary-item.repository';
import { getUserVocabularyListOrThrow } from './user-vocabulary-list.service';
import {
  toTranslateEnglishSentence,
  toTranslateUkrainianSentence,
  type VocabularyItemData,
} from './vocabulary-task.service';

export const getUserVocabularyItemOrThrow = async (
  { userId, userVocabularyItemId }: { userId: string; userVocabularyItemId: string },
  tx: Transaction = db,
) => {
  const userItem = await getUserVocabularyItemById({ userId, userVocabularyItemId }, tx);
  if (!userItem) {
    throw Exception.notFound(`vocabulary item "${userVocabularyItemId}" not found for user`);
  }

  return userItem;
};

export const getUserVocabularyItemWithRelationsOrThrow = async (
  { userId, userVocabularyItemId }: { userId: string; userVocabularyItemId: string },
  tx: Transaction = db,
) => {
  const userItem = await getUserVocabularyItemWithRelationsById({ userId, userVocabularyItemId }, tx);
  if (!userItem) {
    throw Exception.notFound(`vocabulary item "${userVocabularyItemId}" not found for user`);
  }

  return userItem;
};

// locks the row for the duration of the transaction so a concurrent read-modify-write call can't
// race this one to the same encounterCount
const getUserVocabularyItemByIdForUpdateOrThrow = async (
  { userId, userVocabularyItemId }: { userId: string; userVocabularyItemId: string },
  tx: Transaction,
) => {
  const userItem = await getUserVocabularyItemByIdForUpdate({ userId, userVocabularyItemId }, tx);
  if (!userItem) {
    throw Exception.notFound(`vocabulary item "${userVocabularyItemId}" not found for user`);
  }

  return userItem;
};

const getUserVocabularyItemInListForUpdateOrThrow = async (
  {
    userId,
    userVocabularyListId,
    userVocabularyItemId,
  }: { userId: string; userVocabularyListId: string; userVocabularyItemId: string },
  tx: Transaction,
) => {
  const [{ vocabularyListId }, userItem] = await Promise.all([
    getUserVocabularyListOrThrow({ userId, userVocabularyListId }, tx),
    getUserVocabularyItemByIdForUpdateOrThrow({ userId, userVocabularyItemId }, tx),
  ]);
  await getVocabularyListItemOrThrow({ vocabularyListId, vocabularyItemId: userItem.vocabularyItemId }, tx);

  return { userItem };
};

const validateUserVocabularyItemInList = async (
  {
    userId,
    userVocabularyListId,
    userVocabularyItemId,
  }: { userId: string; userVocabularyListId: string; userVocabularyItemId: string },
  tx: Transaction,
) => {
  const [{ vocabularyListId }, userItem] = await Promise.all([
    getUserVocabularyListOrThrow({ userId, userVocabularyListId }, tx),
    getUserVocabularyItemOrThrow({ userId, userVocabularyItemId }, tx),
  ]);
  await getVocabularyListItemOrThrow({ vocabularyListId, vocabularyItemId: userItem.vocabularyItemId }, tx);

  return { vocabularyListId, vocabularyItemId: userItem.vocabularyItemId, userItem };
};

export const createVocabularyListLearnEvents = async ({
  userId,
  userVocabularyListId,
  events,
}: CreateVocabularyListLearnEventsDto & { userId: string; userVocabularyListId: string }) => {
  return db.transaction(async (tx) => {
    const userVocabularyItemIds = unique(events.map(({ userVocabularyItemId }) => userVocabularyItemId));
    const [{ vocabularyListId }, userItems] = await Promise.all([
      getUserVocabularyListOrThrow({ userId, userVocabularyListId }, tx),
      getUserVocabularyItemsByIds({ userId, userVocabularyItemIds }, tx),
    ]);
    if (userItems.length !== userVocabularyItemIds.length) {
      throw Exception.notFound('one or more vocabulary items were not found for user');
    }

    const vocabularyItemIds = userItems.map(({ vocabularyItemId }) => vocabularyItemId);
    const listItems = await getVocabularyListItemsByVocabularyItemIds({ vocabularyListId, vocabularyItemIds }, tx);
    if (listItems.length !== vocabularyItemIds.length) {
      throw Exception.notFound('one or more vocabulary items were not found in the user vocabulary list');
    }

    return await insertEvents(
      events.map((event) => ({ ...event, userId, userVocabularyListId })),
      tx,
    );
  });
};

export const discoverUserVocabularyItem = async ({
  userId,
  userVocabularyListId,
  userVocabularyItemId,
  ...body
}: {
  userId: string;
  userVocabularyListId: string;
  userVocabularyItemId: string;
} & DiscoverUserVocabularyItemDto) => {
  return db.transaction(async (tx) => {
    const { userItem } = await getUserVocabularyItemInListForUpdateOrThrow(
      { userId, userVocabularyListId, userVocabularyItemId },
      tx,
    );

    if (userItem.status !== LearningStatus.Waiting) {
      throw Exception.conflict(`vocabulary item "${userVocabularyItemId}" has already been discovered`);
    }

    await Promise.all([
      insertEvent(
        {
          type: EventType.UserVocabularyItemDiscovered,
          userId,
          userVocabularyItemId,
          userVocabularyListId,
          status: body.status,
          durationMs: body.durationMs,
        },
        tx,
      ),
      updateUserVocabularyItemStatus(
        {
          userId,
          userVocabularyItemId,
          status: body.status,
          enqueuedAt: body.status === LearningStatus.Learning ? new Date() : null,
        },
        tx,
      ),
    ]);

    return await getUserVocabularyItemWithRelationsOrThrow({ userId, userVocabularyItemId }, tx);
  });
};

export const undoUserVocabularyItemStatus = async ({
  userId,
  userVocabularyListId,
  userVocabularyItemId,
}: {
  userId: string;
  userVocabularyListId: string;
  userVocabularyItemId: string;
}) => {
  return db.transaction(async (tx) => {
    const { userItem } = await getUserVocabularyItemInListForUpdateOrThrow(
      { userId, userVocabularyListId, userVocabularyItemId },
      tx,
    );
    if (userItem.status === LearningStatus.Waiting) {
      throw Exception.conflict(`vocabulary item "${userVocabularyItemId}" is already waiting`);
    }

    // programmatically-added items skip the discovery phase, so there may be no event to revert
    const revertedEvent = await revertUserVocabularyItemDiscoveredEvent({ userId, userVocabularyItemId }, tx);

    await Promise.all([
      insertEvent(
        {
          type: EventType.UserVocabularyItemDiscoveryUndone,
          userId,
          userVocabularyItemId,
          userVocabularyListId,
          status: userItem.status,
          encounterCount: userItem.encounterCount,
          durationMs: revertedEvent?.durationMs,
        },
        tx,
      ),
      updateUserVocabularyItemProgress({ userId, userVocabularyItemId, ...newWaitingProgress() }, tx),
    ]);

    return await getUserVocabularyItemWithRelationsOrThrow({ userId, userVocabularyItemId }, tx);
  });
};

export const resetUserVocabularyItemStatus = async ({
  userId,
  userVocabularyListId,
  userVocabularyItemId,
}: {
  userId: string;
  userVocabularyListId: string;
  userVocabularyItemId: string;
}) => {
  return db.transaction(async (tx) => {
    const { userItem } = await getUserVocabularyItemInListForUpdateOrThrow(
      { userId, userVocabularyListId, userVocabularyItemId },
      tx,
    );
    if (userItem.status === LearningStatus.Waiting) {
      throw Exception.conflict(`vocabulary item "${userVocabularyItemId}" is already waiting`);
    }

    await Promise.all([
      insertEvent(
        {
          type: EventType.UserVocabularyItemProgressReset,
          userId,
          userVocabularyItemId,
          userVocabularyListId,
          status: userItem.status,
          encounterCount: userItem.encounterCount,
        },
        tx,
      ),
      updateUserVocabularyItemProgress({ userId, userVocabularyItemId, ...newWaitingProgress() }, tx),
    ]);

    return await getUserVocabularyItemWithRelationsOrThrow({ userId, userVocabularyItemId }, tx);
  });
};

// number of successful confirmations in Learn sessions before an item graduates to `learned`
const LEARNING_CONFIRMATIONS_TO_LEARN = 3;

export const moveUserVocabularyItemToNextStep = async ({
  userId,
  userVocabularyListId,
  userVocabularyItemId,
}: {
  userId: string;
  userVocabularyListId: string;
  userVocabularyItemId: string;
}) => {
  return db.transaction(async (tx) => {
    const { userItem } = await getUserVocabularyItemInListForUpdateOrThrow(
      { userId, userVocabularyListId, userVocabularyItemId },
      tx,
    );

    if (userItem.status !== LearningStatus.Learning) {
      throw Exception.conflict(`vocabulary item "${userVocabularyItemId}" is not in learning status`);
    }

    const encounterCount = userItem.encounterCount + 1;
    const status = encounterCount >= LEARNING_CONFIRMATIONS_TO_LEARN ? LearningStatus.Learned : LearningStatus.Learning;
    const enqueuedAt = status === LearningStatus.Learning ? new Date() : null;

    await Promise.all([
      insertEvent(
        {
          type: EventType.UserVocabularyItemMovedToNextStep,
          userId,
          userVocabularyItemId,
          userVocabularyListId,
          status,
          encounterCount,
        },
        tx,
      ),
      updateUserVocabularyItemProgress({ userId, userVocabularyItemId, status, encounterCount, enqueuedAt }, tx),
    ]);

    return await getUserVocabularyItemWithRelationsOrThrow({ userId, userVocabularyItemId }, tx);
  });
};

// TODO: mutates the shared/global vocabulary_item row, so any user can edit any other user's view of an item's
// translation (intentional for now, see https://github.com/allohamora/learn-helper/pull/88#discussion_r3576727472).
// If this becomes an issue (vandalism, spam), restrict edits to an admin role.
export const updateUserVocabularyItemTranslation = async ({
  userId,
  userVocabularyListId,
  userVocabularyItemId,
  uaTranslation,
}: {
  userId: string;
  userVocabularyListId: string;
  userVocabularyItemId: string;
} & UpdateUserVocabularyItemTranslationDto) => {
  return db.transaction(async (tx) => {
    const { vocabularyItemId } = await validateUserVocabularyItemInList(
      { userId, userVocabularyListId, userVocabularyItemId },
      tx,
    );

    await Promise.all([
      updateVocabularyItemTranslation({ vocabularyItemId, uaTranslation }, tx),
      insertEvent(
        {
          type: EventType.VocabularyItemUpdated,
          userId,
          userVocabularyItemId,
          vocabularyItemId,
          userVocabularyListId,
          fieldName: 'uaTranslation',
        },
        tx,
      ),
    ]);

    return await getUserVocabularyItemWithRelationsOrThrow({ userId, userVocabularyItemId }, tx);
  });
};

export const getUserVocabularyListItems = async ({
  userId,
  userVocabularyListId,
  ...filter
}: UserVocabularyListItemsFilterDto & { userId: string; userVocabularyListId: string }) => {
  const { vocabularyListId } = await getUserVocabularyListOrThrow({ userId, userVocabularyListId });

  return getUserVocabularyListItemsFromRepository({ userId, vocabularyListId, ...filter });
};

const LEARN_BATCH_PATTERN = ['new', 'review', 'review', 'new', 'review', 'review'] as const;

export const buildLearnBatch = <T>(newPool: T[], reviewPool: T[]): T[] => {
  const newQueue = [...newPool];
  const reviewQueue = [...reviewPool];
  const result: T[] = [];

  for (const kind of LEARN_BATCH_PATTERN) {
    const primary = kind === 'new' ? newQueue : reviewQueue;
    const fallback = kind === 'new' ? reviewQueue : newQueue;
    const item = primary.shift() ?? fallback.shift();
    if (item) result.push(item);
  }

  return result;
};

export const getUserVocabularyListLearnItems = async ({
  userId,
  userVocabularyListId,
}: {
  userId: string;
  userVocabularyListId: string;
}) => {
  const { vocabularyListId } = await getUserVocabularyListOrThrow({ userId, userVocabularyListId });

  const [newPool, reviewPool] = await Promise.all([
    getNewItems({ userId, vocabularyListId, limit: LEARN_BATCH_PATTERN.length }),
    getReviewItems({ userId, vocabularyListId, limit: LEARN_BATCH_PATTERN.length }),
  ]);

  return buildLearnBatch(newPool, reviewPool);
};

export const getUserVocabularyListLearnTasks = async ({
  userId,
  userVocabularyListId,
}: {
  userId: string;
  userVocabularyListId: string;
}) => {
  const items = await getUserVocabularyListLearnItems({ userId, userVocabularyListId });
  if (items.length === 0) {
    return { translateEnglishSentenceTasks: [], translateUkrainianSentenceTasks: [] };
  }

  const data: VocabularyItemData[] = items.map((item) => ({
    id: item.id,
    value: item.vocabularyItem.value,
    partOfSpeech: item.vocabularyItem.partOfSpeech,
  }));

  const [translateEnglishSentence, translateUkrainianSentence] = await Promise.all([
    toTranslateEnglishSentence(data),
    toTranslateUkrainianSentence(data),
  ]);

  const userVocabularyItemIds = data.map(({ id }) => id);

  await Promise.all(
    [translateEnglishSentence.cost, translateUkrainianSentence.cost].map((cost) =>
      insertEvent({
        type: EventType.UserVocabularyItemTaskGenerated,
        userId,
        userVocabularyListId,
        userVocabularyItemTaskType: cost.taskType,
        userVocabularyItemIds,
        costInNanoDollars: cost.costInNanoDollars,
        inputTokens: cost.inputTokens,
        outputTokens: cost.outputTokens,
      }),
    ),
  );

  return {
    translateEnglishSentenceTasks: translateEnglishSentence.tasks,
    translateUkrainianSentenceTasks: translateUkrainianSentence.tasks,
  };
};

export const getUserVocabularyListProgress = async ({
  userId,
  userVocabularyListId,
}: {
  userId: string;
  userVocabularyListId: string;
}) => {
  const { vocabularyListId } = await getUserVocabularyListOrThrow({ userId, userVocabularyListId });

  const statusCounts = await getUserVocabularyListItemStatusCounts({
    userId,
    vocabularyListId,
  });

  return statusCounts.reduce(
    (acc, row) => {
      acc.total += row.count;
      acc[row.status] = row.count;
      return acc;
    },
    { total: 0, waiting: 0, learning: 0, learned: 0, known: 0 },
  );
};
