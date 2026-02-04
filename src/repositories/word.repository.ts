import { db, Word, eq } from 'astro:db';
import type { Transaction } from '@/types/db.types';

export const updateWord = async (
  { wordId, uaTranslation }: { wordId: number; uaTranslation: string },
  tx: Transaction = db,
) => {
  await tx.update(Word).set({ uaTranslation }).where(eq(Word.id, wordId));
};
