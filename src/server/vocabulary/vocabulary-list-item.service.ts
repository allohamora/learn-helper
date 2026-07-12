import '@tanstack/react-start/server-only';
import type { UserVocabularyListItemsQuery } from './dto/user-vocabulary-list-item.dto';
import {
  getVocabularyListItems as getVocabularyListItemsFromRepository,
  getVocabularyListItemStatusCounts,
} from './vocabulary-list-item.repository';
import { getUserVocabularyListOrThrow, getVocabularyListByIdOrThrow } from './vocabulary-list.service';

export const getVocabularyListItems = async ({
  userId,
  userVocabularyListId,
  ...query
}: UserVocabularyListItemsQuery & { userId: string; userVocabularyListId: string }) => {
  const userList = await getUserVocabularyListOrThrow(userId, userVocabularyListId);

  return getVocabularyListItemsFromRepository({ userId, vocabularyListId: userList.vocabularyListId, ...query });
};

export const getVocabularyListProgress = async ({
  userId,
  userVocabularyListId,
}: {
  userId: string;
  userVocabularyListId: string;
}) => {
  const userList = await getUserVocabularyListOrThrow(userId, userVocabularyListId);

  const [list, statusCounts] = await Promise.all([
    getVocabularyListByIdOrThrow(userList.vocabularyListId),
    getVocabularyListItemStatusCounts({ userId, vocabularyListId: userList.vocabularyListId }),
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
