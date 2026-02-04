import { updateWord as updateWordRecord } from '@/repositories/word.repository';
import { insertEvent } from '@/repositories/event.repository';
import type { AuthParams } from '@/types/auth.types';
import { EventType } from '@/types/event.types';
import { db } from 'astro:db';

export const updateWord = async ({
  userId,
  wordId,
  uaTranslation,
}: AuthParams<{ wordId: number; uaTranslation: string }>) => {
  await db.transaction(async (tx) => {
    await updateWordRecord({ wordId, uaTranslation }, tx);
    await insertEvent({ userId, wordId, type: EventType.WordUpdated, fieldName: 'uaTranslation' }, tx);
  });
};
