import '@tanstack/react-start/server-only';
import { db } from '../db/db.service';
import type { Transaction } from '../db/db.types';
import { Exception } from '../utils/exception.utils';
import { getVocabularyListById } from './vocabulary-list.repository';

export const getVocabularyListByIdOrThrow = async (vocabularyListId: string, tx: Transaction = db) => {
  const list = await getVocabularyListById(vocabularyListId, tx);
  if (!list) throw Exception.notFound(`vocabulary list "${vocabularyListId}" not found`);

  return list;
};
