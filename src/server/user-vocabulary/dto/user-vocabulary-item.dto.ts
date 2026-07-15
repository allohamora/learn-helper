import '@tanstack/react-start/server-only';
import { z } from '@hono/zod-openapi';
import { LearningStatus } from '@/const/vocabulary';

export const userVocabularyItemDto = z.object({
  value: z.string(),
  definition: z.string(),
  uaTranslation: z.string(),
  partOfSpeech: z.string().nullable(),
  spelling: z.string(),
  pronunciation: z.string().nullable(),
  link: z.string().nullable(),
  userVocabularyItemId: z.uuidv7(),
  status: z.enum(LearningStatus),
  encounterCount: z.number(),
  createdAt: z.iso.datetime(),
});
