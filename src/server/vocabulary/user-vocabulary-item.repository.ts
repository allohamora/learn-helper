import { sql } from 'drizzle-orm';
import { userVocabularyItem, vocabularyListItem } from '../db/db.schema';
import { db } from '../db/db.service';
import type { Transaction } from '../db/db.types';

export const createUserVocabularyItemsFromList = async (
  userId: string,
  vocabularyListId: string,
  tx: Transaction = db,
) => {
  await tx.execute(sql`
    INSERT INTO ${userVocabularyItem} (${sql.raw(userVocabularyItem.userId.name)}, ${sql.raw(userVocabularyItem.vocabularyItemId.name)})
    SELECT ${userId}, ${vocabularyListItem.vocabularyItemId}
    FROM ${vocabularyListItem}
    WHERE ${vocabularyListItem.vocabularyListId} = ${vocabularyListId}
    ORDER BY ${vocabularyListItem.createdAt} ASC
    ON CONFLICT (${sql.raw(userVocabularyItem.userId.name)}, ${sql.raw(userVocabularyItem.vocabularyItemId.name)}) DO NOTHING
  `);
};
