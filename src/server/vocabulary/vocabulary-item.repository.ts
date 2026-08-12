import '@tanstack/react-start/server-only';
import { and, asc, count, eq, getTableColumns, gte, ilike } from 'drizzle-orm';
import { RequestType } from '@/const/request';
import { vocabularyItem, vocabularyListItem } from '../db/db.schema';
import { db } from '../db/db.service';
import { escapeLikePattern } from '../db/db.utils';
import type { Transaction } from '../db/db.types';
import type { PersonalVocabularyItemSearchFilterDto } from '../user-vocabulary/dtos/personal-vocabulary-item-search-filter.dto';

export const getVocabularyItemById = async (vocabularyItemId: string, tx: Transaction = db) => {
  return tx.query.vocabularyItem.findFirst({ where: eq(vocabularyItem.id, vocabularyItemId) });
};

// inserts rows not already present (matched by value + partOfSpeech); returns only the newly inserted rows
export const createMissingVocabularyItems = async (values: (typeof vocabularyItem.$inferInsert)[]) => {
  if (values.length === 0) return [];

  return await db
    .insert(vocabularyItem)
    .values(values)
    .onConflictDoNothing({ target: [vocabularyItem.value, vocabularyItem.partOfSpeech] })
    .returning();
};

export const updateVocabularyItemTranslation = async (
  { vocabularyItemId, uaTranslation }: { vocabularyItemId: string; uaTranslation: string },
  tx: Transaction = db,
) => {
  await tx.update(vocabularyItem).set({ uaTranslation }).where(eq(vocabularyItem.id, vocabularyItemId));
};

export const searchVocabularyItemsForList = async ({
  vocabularyListId,
  value,
  cursor,
  limit = 50,
  type = RequestType.All,
}: { vocabularyListId: string } & PersonalVocabularyItemSearchFilterDto) => {
  const searchFilter = ilike(vocabularyItem.value, `%${escapeLikePattern(value)}%`);
  const cursorFilter = cursor ? gte(vocabularyItem.id, cursor) : undefined;

  const getItems = async () => {
    const items = await db
      .select({ ...getTableColumns(vocabularyItem), vocabularyListItem })
      .from(vocabularyItem)
      .leftJoin(
        vocabularyListItem,
        and(
          eq(vocabularyListItem.vocabularyItemId, vocabularyItem.id),
          eq(vocabularyListItem.vocabularyListId, vocabularyListId),
        ),
      )
      .where(and(searchFilter, cursorFilter))
      .orderBy(asc(vocabularyItem.id))
      .limit(limit + 1);

    const nextCursor = items.length > limit ? items.pop()?.id : undefined;

    return { items, nextCursor };
  };

  const getTotal = async () => {
    const [total] = await db.select({ total: count() }).from(vocabularyItem).where(searchFilter);

    return total;
  };

  if (type === RequestType.Data) {
    const { items, nextCursor } = await getItems();

    return { items, total: 0, nextCursor };
  }

  const [items, total] = await Promise.all([getItems(), getTotal()]);

  return { ...items, ...total };
};
