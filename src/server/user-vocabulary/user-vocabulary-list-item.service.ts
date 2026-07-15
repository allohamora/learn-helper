import '@tanstack/react-start/server-only';
import type { UserVocabularyListItemsFilterDto } from './dto/user-vocabulary-list-items-filter.dto';
import {
  getNewItems,
  getReviewItems,
  getUserVocabularyListItems as getUserVocabularyListItemsFromRepository,
  getUserVocabularyListItemStatusCounts,
} from './user-vocabulary-list-item.repository';
import { getUserVocabularyListOrThrow } from './user-vocabulary-list.service';

export const getUserVocabularyListItems = async ({
  userId,
  userVocabularyListId,
  ...filter
}: UserVocabularyListItemsFilterDto & { userId: string; userVocabularyListId: string }) => {
  const userList = await getUserVocabularyListOrThrow({ userId, userVocabularyListId });

  return getUserVocabularyListItemsFromRepository({ userId, vocabularyListId: userList.vocabularyListId, ...filter });
};

const LEARNING_BATCH_PATTERN = ['new', 'old', 'old', 'new', 'old', 'old'] as const;

export const buildLearningBatch = <T>(newPool: T[], oldPool: T[]): T[] => {
  const newQueue = [...newPool];
  const oldQueue = [...oldPool];
  const result: T[] = [];

  for (const kind of LEARNING_BATCH_PATTERN) {
    const primary = kind === 'new' ? newQueue : oldQueue;
    const fallback = kind === 'new' ? oldQueue : newQueue;
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
  const userList = await getUserVocabularyListOrThrow({ userId, userVocabularyListId });

  const [newPool, oldPool] = await Promise.all([
    getNewItems({ userId, vocabularyListId: userList.vocabularyListId, limit: LEARNING_BATCH_PATTERN.length }),
    getReviewItems({ userId, vocabularyListId: userList.vocabularyListId, limit: LEARNING_BATCH_PATTERN.length }),
  ]);

  return buildLearningBatch(newPool, oldPool);
};

export const getUserVocabularyListProgress = async ({
  userId,
  userVocabularyListId,
}: {
  userId: string;
  userVocabularyListId: string;
}) => {
  const userList = await getUserVocabularyListOrThrow({ userId, userVocabularyListId });

  const statusCounts = await getUserVocabularyListItemStatusCounts({
    userId,
    vocabularyListId: userList.vocabularyListId,
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
