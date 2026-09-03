import '@tanstack/react-start/server-only';
import { db } from '../db/db.service';
import type { Transaction } from '../db/db.types';
import { Exception } from '../utils/exception.utils';
import { getVocabularyListItem } from './vocabulary-list-item.repository';

export const getVocabularyListItemOrThrow = async (
  { vocabularyListId, vocabularyItemId }: { vocabularyListId: string; vocabularyItemId: string },
  tx: Transaction = db,
) => {
  const listItem = await getVocabularyListItem({ vocabularyListId, vocabularyItemId }, tx);
  if (!listItem) {
    throw Exception.notFound(`Vocabulary item "${vocabularyItemId}" is not linked to list "${vocabularyListId}"`);
  }

  return listItem;
};
