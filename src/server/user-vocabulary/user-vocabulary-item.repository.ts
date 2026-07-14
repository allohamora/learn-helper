import '@tanstack/react-start/server-only';
import { and, eq, sql } from 'drizzle-orm';
import { LearningStatus } from '@/const/vocabulary';
import { userVocabularyItem, userVocabularyList, vocabularyListItem } from '../db/db.schema';
import { db } from '../db/db.service';
import type { Transaction } from '../db/db.types';
import { Exception } from '../utils/exception.utils';

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
export const getUserVocabularyListItemLinkOrThrow = async (
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

  if (!link) {
    throw Exception.notFound(
      `vocabulary list "${userVocabularyListId}" and item "${userVocabularyItemId}" are not linked for user`,
    );
  }

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
