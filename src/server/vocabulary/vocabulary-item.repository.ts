import '@tanstack/react-start/server-only';
import { and, asc, count, eq, gte, ilike } from 'drizzle-orm';
import { RequestType } from '@/const/request';
import { vocabularyItem } from '../db/db.schema';
import { db } from '../db/db.service';
import type { Transaction } from '../db/db.types';
import type { VocabularyItemFilterDto } from './dtos/vocabulary-item-filter.dto';

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

export const searchVocabularyItems = async ({
  value,
  cursor,
  limit = 50,
  type = RequestType.All,
}: VocabularyItemFilterDto) => {
  const searchFilter = ilike(vocabularyItem.value, `%${value}%`);
  const cursorFilter = cursor ? gte(vocabularyItem.id, cursor) : undefined;

  const getItems = async () => {
    const items = await db
      .select()
      .from(vocabularyItem)
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
