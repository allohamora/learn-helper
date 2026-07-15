import '@tanstack/react-start/server-only';
import { and, asc, count, eq, gte, ilike, sql } from 'drizzle-orm';
import { LearningStatus } from '@/const/vocabulary';
import { RequestType } from '@/const/request';
import { userVocabularyItem, userVocabularyList, vocabularyItem, vocabularyListItem } from '../db/db.schema';
import { db } from '../db/db.service';
import type { Transaction } from '../db/db.types';
import type { UserVocabularyListItemsFilterDto } from './dto/user-vocabulary-list-items-filter.dto';

export const createUserVocabularyItemsFromList = async (
  { userId, vocabularyListId }: { userId: string; vocabularyListId: string },
  tx: Transaction = db,
) => {
  await tx.execute(sql`
    INSERT INTO ${userVocabularyItem} (${sql.raw(userVocabularyItem.userId.name)}, ${sql.raw(userVocabularyItem.vocabularyItemId.name)})
    SELECT ${userId}, ${vocabularyListItem.vocabularyItemId}
    FROM ${vocabularyListItem}
    WHERE ${vocabularyListItem.vocabularyListId} = ${vocabularyListId}
    ORDER BY ${vocabularyListItem.id} ASC
    ON CONFLICT (${sql.raw(userVocabularyItem.userId.name)}, ${sql.raw(userVocabularyItem.vocabularyItemId.name)}) DO NOTHING
  `);
};

// verifies, in one query, that userVocabularyListId belongs to userId, userVocabularyItemId belongs
// to userId, and the item is actually linked to that list (via vocabularyListItem) — so a status
// update can't be attributed (through the event's userVocabularyListId) to a list the item isn't in
export const getUserVocabularyListItemLink = async (
  {
    userId,
    userVocabularyListId,
    userVocabularyItemId,
  }: { userId: string; userVocabularyListId: string; userVocabularyItemId: string },
  tx: Transaction = db,
) => {
  const [link] = await tx
    .select({
      userVocabularyListId: userVocabularyList.id,
      userVocabularyItemId: userVocabularyItem.id,
      vocabularyItemId: userVocabularyItem.vocabularyItemId,
    })
    .from(userVocabularyList)
    .innerJoin(vocabularyListItem, eq(vocabularyListItem.vocabularyListId, userVocabularyList.vocabularyListId))
    .innerJoin(
      userVocabularyItem,
      and(
        eq(userVocabularyItem.vocabularyItemId, vocabularyListItem.vocabularyItemId),
        eq(userVocabularyItem.userId, userId),
      ),
    )
    .where(
      and(
        eq(userVocabularyList.id, userVocabularyListId),
        eq(userVocabularyList.userId, userId),
        eq(userVocabularyItem.id, userVocabularyItemId),
      ),
    )
    .limit(1);

  return link;
};

export const updateUserVocabularyItemStatus = async (
  { userId, userVocabularyItemId, status }: { userId: string; userVocabularyItemId: string; status: LearningStatus },
  tx: Transaction = db,
) => {
  await tx
    .update(userVocabularyItem)
    .set({ status, updatedAt: new Date() })
    .where(and(eq(userVocabularyItem.id, userVocabularyItemId), eq(userVocabularyItem.userId, userId)));
};

export const getUserVocabularyListItems = async ({
  userId,
  vocabularyListId,
  status,
  search,
  cursor,
  limit = 20,
  type = RequestType.All,
}: UserVocabularyListItemsFilterDto & { userId: string; vocabularyListId: string }) => {
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

export const getNewItems = async ({
  userId,
  vocabularyListId,
  limit,
}: {
  userId: string;
  vocabularyListId: string;
  limit: number;
}) =>
  await db
    .select({
      id: userVocabularyItem.id,
      userId: userVocabularyItem.userId,
      vocabularyItemId: userVocabularyItem.vocabularyItemId,
      encounterCount: userVocabularyItem.encounterCount,
      status: userVocabularyItem.status,
      enqueuedAt: userVocabularyItem.enqueuedAt,
      createdAt: userVocabularyItem.createdAt,
      updatedAt: userVocabularyItem.updatedAt,
      vocabularyItem,
    })
    .from(vocabularyListItem)
    .innerJoin(vocabularyItem, eq(vocabularyListItem.vocabularyItemId, vocabularyItem.id))
    .innerJoin(userVocabularyItem, eq(userVocabularyItem.vocabularyItemId, vocabularyItem.id))
    .where(
      and(
        eq(vocabularyListItem.vocabularyListId, vocabularyListId),
        eq(userVocabularyItem.userId, userId),
        eq(userVocabularyItem.status, LearningStatus.Learning),
        eq(userVocabularyItem.encounterCount, 0),
      ),
    )
    .orderBy(asc(userVocabularyItem.enqueuedAt))
    .limit(limit);

export const getReviewItems = async ({
  userId,
  vocabularyListId,
  limit,
}: {
  userId: string;
  vocabularyListId: string;
  limit: number;
}) =>
  await db
    .select({
      id: userVocabularyItem.id,
      userId: userVocabularyItem.userId,
      vocabularyItemId: userVocabularyItem.vocabularyItemId,
      encounterCount: userVocabularyItem.encounterCount,
      status: userVocabularyItem.status,
      enqueuedAt: userVocabularyItem.enqueuedAt,
      createdAt: userVocabularyItem.createdAt,
      updatedAt: userVocabularyItem.updatedAt,
      vocabularyItem,
    })
    .from(vocabularyListItem)
    .innerJoin(vocabularyItem, eq(vocabularyListItem.vocabularyItemId, vocabularyItem.id))
    .innerJoin(userVocabularyItem, eq(userVocabularyItem.vocabularyItemId, vocabularyItem.id))
    .where(
      and(
        eq(vocabularyListItem.vocabularyListId, vocabularyListId),
        eq(userVocabularyItem.userId, userId),
        eq(userVocabularyItem.status, LearningStatus.Learning),
        gte(userVocabularyItem.encounterCount, 1),
      ),
    )
    .orderBy(asc(userVocabularyItem.enqueuedAt))
    .limit(limit);

export const getUserVocabularyListItemStatusCounts = async ({
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
