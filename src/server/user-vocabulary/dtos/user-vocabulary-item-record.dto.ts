import '@tanstack/react-start/server-only';
import { z } from '@hono/zod-openapi';
import { LearningStatus } from '@/const/vocabulary';

export const userVocabularyItemRecordDto = z.object({
  id: z.uuidv7(),
  userId: z.string(),
  vocabularyItemId: z.uuidv7(),
  encounterCount: z.number().int().nonnegative(),
  status: z.enum(LearningStatus),
  enqueuedAt: z.iso.datetime().nullable(),
  createdAt: z.iso.datetime(),
  updatedAt: z.iso.datetime(),
});
