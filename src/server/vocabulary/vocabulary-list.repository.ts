import { eq } from 'drizzle-orm';
import { vocabularyList } from '../db/db.schema';
import { db } from '../db/db.service';
import { Exception } from '../utils/exception.utils';

export const findOrCreateVocabularyListByTitle = async (title: string) => {
  const [inserted] = await db
    .insert(vocabularyList)
    .values({ title })
    .onConflictDoNothing({ target: vocabularyList.title })
    .returning();
  if (inserted) return inserted;

  const existing = await db.query.vocabularyList.findFirst({ where: eq(vocabularyList.title, title) });
  if (!existing) throw Exception.internalServer(`failed to find or create vocabulary list "${title}"`);

  return existing;
};
