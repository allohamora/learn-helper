import '@tanstack/react-start/server-only';
import { and, asc, count, eq, gte, ilike } from 'drizzle-orm';
import type { VocabularyListItemsQuery } from './dto/vocabulary-list-item.dto';
import { userVocabularyItem, vocabularyItem, vocabularyListItem } from '../db/db.schema';
import { db } from '../db/db.service';
import { RequestType } from '@/const/request';

export const createVocabularyListItemsIfNotExist = async (values: (typeof vocabularyListItem.$inferInsert)[]) => {
  if (values.length === 0) return;

  await db
    .insert(vocabularyListItem)
    .values(values)
    .onConflictDoNothing({ target: [vocabularyListItem.vocabularyListId, vocabularyListItem.vocabularyItemId] });
};

export const getVocabularyListItems = async ({
  userId,
  vocabularyListId,
  status,
  search,
  cursor,
  limit = 20,
  type = RequestType.All,
}: VocabularyListItemsQuery & { userId: string; vocabularyListId: string }) => {
  const listFilter = eq(vocabularyListItem.vocabularyListId, vocabularyListId);
  const userFilter = eq(userVocabularyItem.userId, userId);

  const statusFilter = status ? eq(userVocabularyItem.status, status) : undefined;
  const searchFilter = search ? ilike(vocabularyItem.value, `%${search}%`) : undefined;
  const cursorFilter = cursor ? gte(userVocabularyItem.id, cursor) : undefined;

  const items = await db
    .select({
      value: vocabularyItem.value,
      definition: vocabularyItem.definition,
      uaTranslation: vocabularyItem.uaTranslation,
      partOfSpeech: vocabularyItem.partOfSpeech,
      spelling: vocabularyItem.spelling,
      pronunciation: vocabularyItem.pronunciation,
      link: vocabularyItem.link,
      userVocabularyItemId: userVocabularyItem.id,
      status: userVocabularyItem.status,
      encounterCount: userVocabularyItem.encounterCount,
      createdAt: userVocabularyItem.createdAt,
    })
    .from(vocabularyListItem)
    .innerJoin(vocabularyItem, eq(vocabularyListItem.vocabularyItemId, vocabularyItem.id))
    .innerJoin(userVocabularyItem, eq(userVocabularyItem.vocabularyItemId, vocabularyItem.id))
    .where(and(listFilter, userFilter, statusFilter, searchFilter, cursorFilter))
    .orderBy(asc(userVocabularyItem.id))
    .limit(limit + 1);

  const nextCursor = items.length > limit ? items.pop()?.userVocabularyItemId : undefined;

  if (type === RequestType.Data) {
    return {
      items,
      total: 0,
      nextCursor,
    };
  }

  const [{ total }] = await db
    .select({ total: count() })
    .from(vocabularyListItem)
    .innerJoin(vocabularyItem, eq(vocabularyListItem.vocabularyItemId, vocabularyItem.id))
    .innerJoin(userVocabularyItem, eq(userVocabularyItem.vocabularyItemId, vocabularyItem.id))
    .where(and(listFilter, userFilter, statusFilter, searchFilter));

  return {
    items,
    total,
    nextCursor,
  };
};

export const getVocabularyListItemStatusCounts = async ({
  userId,
  vocabularyListId,
}: {
  userId: string;
  vocabularyListId: string;
}) => {
  return db
    .select({ status: userVocabularyItem.status, count: count() })
    .from(vocabularyListItem)
    .innerJoin(userVocabularyItem, eq(vocabularyListItem.vocabularyItemId, userVocabularyItem.vocabularyItemId))
    .where(and(eq(vocabularyListItem.vocabularyListId, vocabularyListId), eq(userVocabularyItem.userId, userId)))
    .groupBy(userVocabularyItem.status);
};
