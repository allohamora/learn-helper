import '@tanstack/react-start/server-only';
import { z } from '@hono/zod-openapi';
import { LearningStatus } from '@/const/vocabulary';

export const setUserVocabularyItemStatusDto = z.object({
  status: z.enum([LearningStatus.Known, LearningStatus.Learning]),
  durationMs: z.number().int().nonnegative(),
});

export type SetUserVocabularyItemStatusDto = z.infer<typeof setUserVocabularyItemStatusDto>;
