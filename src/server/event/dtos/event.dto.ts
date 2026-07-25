import '@tanstack/react-start/server-only';
import { z } from '@hono/zod-openapi';
import { EventType, UserVocabularyItemTaskType } from '@/const/event';
import { LearningStatus } from '@/const/vocabulary';

export const eventDto = z.object({
  id: z.uuidv7(),
  userId: z.string(),
  type: z.enum(EventType),
  userVocabularyItemId: z.uuidv7().nullable(),
  userVocabularyItemIds: z.array(z.uuidv7()).nullable(),
  vocabularyItemId: z.uuidv7().nullable(),
  userVocabularyListId: z.uuidv7().nullable(),
  status: z.enum(LearningStatus).nullable(),
  userVocabularyItemTaskType: z.enum(UserVocabularyItemTaskType).nullable(),
  fieldName: z.string().nullable(),
  durationMs: z.number().int().nullable(),
  encounterCount: z.number().int().nullable(),
  costInNanoDollars: z.number().nullable(),
  inputTokens: z.number().int().nullable(),
  outputTokens: z.number().int().nullable(),
  revertedAt: z.iso.datetime().nullable(),
  createdAt: z.iso.datetime(),
});
