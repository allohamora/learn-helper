import '@tanstack/react-start/server-only';
import { z } from '@hono/zod-openapi';
import { LearningStatus } from '@/const/vocabulary';

export const userVocabularyItemStatusDto = z.object({
  userVocabularyItemId: z.uuidv7(),
  status: z.enum(LearningStatus),
});
