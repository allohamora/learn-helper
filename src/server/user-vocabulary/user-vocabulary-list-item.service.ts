import '@tanstack/react-start/server-only';
import type { UserVocabularyListItemsFilterDto } from './dto/user-vocabulary-list-items-filter.dto';
import {
  getUserVocabularyListItems as getUserVocabularyListItemsFromRepository,
  getUserVocabularyListItemStatusCounts,
} from './user-vocabulary-list-item.repository';
import { getUserVocabularyListOrThrow } from './user-vocabulary-list.repository';
import { getVocabularyListByIdOrThrow } from '../vocabulary/vocabulary-list.repository';

export const getUserVocabularyListItems = async ({
  userId,
  userVocabularyListId,
  ...filter
}: UserVocabularyListItemsFilterDto & { userId: string; userVocabularyListId: string }) => {
  const userList = await getUserVocabularyListOrThrow({ userId, userVocabularyListId });

  return getUserVocabularyListItemsFromRepository({ userId, vocabularyListId: userList.vocabularyListId, ...filter });
};

export const getUserVocabularyListProgress = async ({
  userId,
  userVocabularyListId,
}: {
  userId: string;
  userVocabularyListId: string;
}) => {
  const userList = await getUserVocabularyListOrThrow({ userId, userVocabularyListId });

  const [list, statusCounts] = await Promise.all([
    getVocabularyListByIdOrThrow(userList.vocabularyListId),
    getUserVocabularyListItemStatusCounts({ userId, vocabularyListId: userList.vocabularyListId }),
  ]);

  const counts = statusCounts.reduce(
    (acc, row) => {
      acc.total += row.count;
      acc[row.status] = row.count;
      return acc;
    },
    { total: 0, waiting: 0, learning: 0, learned: 0, known: 0 },
  );

  return { title: list.title, ...counts };
};
