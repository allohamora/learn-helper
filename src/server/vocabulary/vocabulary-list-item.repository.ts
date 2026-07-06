import { vocabularyListItem } from '../db/db.schema';
import { db } from '../db/db.service';

export const createVocabularyListItemsIfNotExist = async (values: (typeof vocabularyListItem.$inferInsert)[]) => {
  if (values.length === 0) return;

  await db
    .insert(vocabularyListItem)
    .values(values)
    .onConflictDoNothing({ target: [vocabularyListItem.vocabularyListId, vocabularyListItem.vocabularyItemId] });
};
