import { db, Word, eq } from 'astro:db';

export const updateUaTranslation = async ({ wordId, value }: { wordId: number; value: string }) => {
  await db.update(Word).set({ uaTranslation: value }).where(eq(Word.id, wordId));
};
