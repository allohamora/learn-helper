import '@tanstack/react-start/server-only';
import { EventType } from '@/const/event';
import { LearningStatus } from '@/const/vocabulary';
import { updateVocabularyItemTranslation } from '../vocabulary/vocabulary-item.repository';
import { db } from '../db/db.service';
import type { Transaction } from '../db/db.types';
import { insertEvent, revertUserVocabularyItemDiscoveredEvent } from '../event/event.repository';
import { Exception } from '../utils/exception.utils';
import { getVocabularyListItemOrThrow } from '../vocabulary/vocabulary-list-item.service';
import type { SetUserVocabularyItemStatusDto } from './dtos/set-user-vocabulary-item-status.dto';
import type { UpdateUserVocabularyItemTranslationDto } from './dtos/update-user-vocabulary-item-translation.dto';
import type { UserVocabularyListItemsFilterDto } from './dtos/user-vocabulary-list-items-filter.dto';
import {
  getNewItems,
  getReviewItems,
  getUserVocabularyItemById,
  getUserVocabularyItemByIdForUpdate,
  getUserVocabularyListItems as getUserVocabularyListItemsFromRepository,
  getUserVocabularyListItemStatusCounts,
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

export const setUserVocabularyItemStatus = async ({
  userId,
  userVocabularyListId,
  userVocabularyItemId,
  ...body
}: {
  userId: string;
  userVocabularyListId: string;
  userVocabularyItemId: string;
} & SetUserVocabularyItemStatusDto) => {
  return db.transaction(async (tx) => {
    await validateUserVocabularyItemInList({ userId, userVocabularyListId, userVocabularyItemId }, tx);

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

    return { userVocabularyItemId, status: body.status };
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
    await validateUserVocabularyItemInList({ userId, userVocabularyListId, userVocabularyItemId }, tx);

    const revertedEvent = await revertUserVocabularyItemDiscoveredEvent({ userId, userVocabularyItemId }, tx);
    if (!revertedEvent) {
      throw Exception.notFound(`no active discovery event for user vocabulary item "${userVocabularyItemId}"`);
    }

    await Promise.all([
      insertEvent(
        {
          type: EventType.UserVocabularyItemDiscoveryUndone,
          userId,
          userVocabularyItemId,
          userVocabularyListId,
          durationMs: revertedEvent.durationMs,
        },
        tx,
      ),
      updateUserVocabularyItemStatus(
        { userId, userVocabularyItemId, status: LearningStatus.Waiting, enqueuedAt: null },
        tx,
      ),
    ]);

    return { userVocabularyItemId, status: LearningStatus.Waiting };
  });
};

// number of successful confirmations in Learning sessions before a word graduates to `learned`
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
    const [{ vocabularyListId }, userItem] = await Promise.all([
      getUserVocabularyListOrThrow({ userId, userVocabularyListId }, tx),
      getUserVocabularyItemByIdForUpdateOrThrow({ userId, userVocabularyItemId }, tx),
    ]);
    await getVocabularyListItemOrThrow({ vocabularyListId, vocabularyItemId: userItem.vocabularyItemId }, tx);

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

    return { userVocabularyItemId, status, encounterCount };
  });
};

// TODO: mutates the shared/global vocabulary_item row, so any user can edit any other user's view of a word's
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

    return { userVocabularyItemId, uaTranslation };
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

const LEARNING_BATCH_PATTERN = ['new', 'review', 'review', 'new', 'review', 'review'] as const;

export const buildLearningBatch = <T>(newPool: T[], reviewPool: T[]): T[] => {
  const newQueue = [...newPool];
  const reviewQueue = [...reviewPool];
  const result: T[] = [];

  for (const kind of LEARNING_BATCH_PATTERN) {
    const primary = kind === 'new' ? newQueue : reviewQueue;
    const fallback = kind === 'new' ? reviewQueue : newQueue;
    const item = primary.shift() ?? fallback.shift();
    if (item) result.push(item);
  }

  return result;
};

export const getUserVocabularyListLearningItems = async ({
  userId,
  userVocabularyListId,
}: {
  userId: string;
  userVocabularyListId: string;
}) => {
  const { vocabularyListId } = await getUserVocabularyListOrThrow({ userId, userVocabularyListId });

  const [newPool, reviewPool] = await Promise.all([
    getNewItems({ userId, vocabularyListId, limit: LEARNING_BATCH_PATTERN.length }),
    getReviewItems({ userId, vocabularyListId, limit: LEARNING_BATCH_PATTERN.length }),
  ]);

  return buildLearningBatch(newPool, reviewPool);
};

export const getUserVocabularyListLearningTasks = async ({
  userId,
  userVocabularyListId,
}: {
  userId: string;
  userVocabularyListId: string;
}) => {
  const items = await getUserVocabularyListLearningItems({ userId, userVocabularyListId });
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
