import { db, Word, eq } from 'astro:db';
import type { Transaction } from '@/types/db.types';

export const updateUaTranslation = async (
  { wordId, value }: { wordId: number; value: string },
  tx: Transaction = db,
) => {
  await tx.update(Word).set({ uaTranslation: value }).where(eq(Word.id, wordId));
};
