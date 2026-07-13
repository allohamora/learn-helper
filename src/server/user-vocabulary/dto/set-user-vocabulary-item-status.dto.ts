import '@tanstack/react-start/server-only';
import { z } from '@hono/zod-openapi';
import { LearningStatus } from '@/const/vocabulary';

export const setUserVocabularyItemStatusDto = z.discriminatedUnion('status', [
  z.object({ status: z.literal(LearningStatus.Waiting) }),
  z.object({ status: z.literal(LearningStatus.Known), durationMs: z.number().int().nonnegative() }),
  z.object({ status: z.literal(LearningStatus.Learning), durationMs: z.number().int().nonnegative() }),
]);

export type SetUserVocabularyItemStatusDto = z.infer<typeof setUserVocabularyItemStatusDto>;
