import '@tanstack/react-start/server-only';
import { db } from '../db/db.service';
import type { Transaction } from '../db/db.types';
import { Exception } from '../utils/exception.utils';
import {
  getVocabularyListById,
  getVocabularyListByTitle,
  insertVocabularyListIgnoringConflict,
} from './vocabulary-list.repository';

export const findOrCreateVocabularyListByTitle = async (title: string) => {
  const inserted = await insertVocabularyListIgnoringConflict(title);
  if (inserted) return inserted;

  const existing = await getVocabularyListByTitle(title);
  if (!existing) throw Exception.internalServer(`Failed to find or create vocabulary list "${title}"`);

  return existing;
};

export const getVocabularyListByIdOrThrow = async (vocabularyListId: string, tx: Transaction = db) => {
  const list = await getVocabularyListById(vocabularyListId, tx);
  if (!list) throw Exception.notFound(`Vocabulary list "${vocabularyListId}" not found`);

  return list;
};
