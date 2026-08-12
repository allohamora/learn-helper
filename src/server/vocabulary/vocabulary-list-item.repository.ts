import '@tanstack/react-start/server-only';
import { and, eq, inArray } from 'drizzle-orm';
import { vocabularyListItem } from '../db/db.schema';
import { db } from '../db/db.service';
import type { Transaction } from '../db/db.types';

export const createVocabularyListItemsIfNotExist = async (
  values: (typeof vocabularyListItem.$inferInsert)[],
  tx: Transaction = db,
) => {
  if (values.length === 0) return;

  await tx
    .insert(vocabularyListItem)
    .values(values)
    .onConflictDoNothing({ target: [vocabularyListItem.vocabularyListId, vocabularyListItem.vocabularyItemId] });
};

export const createVocabularyListItem = async (
  values: typeof vocabularyListItem.$inferInsert,
  tx: Transaction = db,
) => {
  const [created] = await tx.insert(vocabularyListItem).values(values).returning();

  return created;
};

export const createVocabularyListItemIfNotExist = async (
  values: typeof vocabularyListItem.$inferInsert,
  tx: Transaction = db,
) => {
  const [created] = await tx
    .insert(vocabularyListItem)
    .values(values)
    .onConflictDoNothing({ target: [vocabularyListItem.vocabularyListId, vocabularyListItem.vocabularyItemId] })
    .returning();

  return created;
};

export const getVocabularyListItem = async (
  { vocabularyListId, vocabularyItemId }: { vocabularyListId: string; vocabularyItemId: string },
  tx: Transaction = db,
) => {
  return tx.query.vocabularyListItem.findFirst({
    where: and(
      eq(vocabularyListItem.vocabularyListId, vocabularyListId),
      eq(vocabularyListItem.vocabularyItemId, vocabularyItemId),
    ),
  });
};

export const getVocabularyListItemsByVocabularyItemIds = async (
  { vocabularyListId, vocabularyItemIds }: { vocabularyListId: string; vocabularyItemIds: string[] },
  tx: Transaction = db,
) => {
  return tx.query.vocabularyListItem.findMany({
    where: and(
      eq(vocabularyListItem.vocabularyListId, vocabularyListId),
      inArray(vocabularyListItem.vocabularyItemId, vocabularyItemIds),
    ),
  });
};
