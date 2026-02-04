import { updateUaTranslation } from '@/repositories/word.repository';
import { insertEvent } from '@/repositories/event.repository';
import type { AuthParams } from '@/types/auth.types';
import { EventType } from '@/types/event.types';
import { db } from 'astro:db';

export const updateUaTranslationWord = async ({
  userId,
  wordId,
  userWordId,
  value,
}: AuthParams<{ wordId: number; userWordId: number; value: string }>) => {
  await db.transaction(async (tx) => {
    await updateUaTranslation({ wordId, value }, tx);
    await insertEvent({ userId, userWordId, type: EventType.UaTranslationUpdated }, tx);
  });
};
