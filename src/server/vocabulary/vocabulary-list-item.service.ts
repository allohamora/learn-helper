import '@tanstack/react-start/server-only';
import type { VocabularyListItemsQuery } from './dto/vocabulary-list-item.dto';
import { getVocabularyListItems as getVocabularyListItemsFromRepository } from './vocabulary-list-item.repository';
import { getUserVocabularyListOrThrow } from './vocabulary-list.service';

export const getVocabularyListItems = async ({
  userId,
  userVocabularyListId,
  ...query
}: VocabularyListItemsQuery & { userId: string; userVocabularyListId: string }) => {
  const userList = await getUserVocabularyListOrThrow(userId, userVocabularyListId);

  return getVocabularyListItemsFromRepository({ userId, vocabularyListId: userList.vocabularyListId, ...query });
};
