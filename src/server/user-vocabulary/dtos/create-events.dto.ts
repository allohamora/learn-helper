import '@tanstack/react-start/server-only';
import { z } from '@hono/zod-openapi';
import { EventType, UserVocabularyItemTaskType } from '@/const/event';

const userVocabularyItemId = z.uuidv7();
const durationMs = z.number().int().nonnegative();
const userVocabularyItemTaskType = z.enum(UserVocabularyItemTaskType);

export const createEventsDto = z.object({
  events: z
    .array(
      z.discriminatedUnion('type', [
        z.object({
          type: z.literal(EventType.UserVocabularyItemTaskFailed),
          userVocabularyItemId,
          userVocabularyItemTaskType,
        }),
        z.object({
          type: z.enum([EventType.UserVocabularyItemTaskPassed, EventType.UserVocabularyItemTaskRetryPassed]),
          userVocabularyItemId,
          durationMs,
          userVocabularyItemTaskType,
        }),
        z.object({
          type: z.literal(EventType.UserVocabularyItemTaskShowcaseViewed),
          userVocabularyItemId,
          durationMs,
        }),
        z.object({
          type: z.literal(EventType.UserVocabularyItemTaskHintUsed),
          userVocabularyItemId,
          userVocabularyItemTaskType,
        }),
      ]),
    )
    .min(1),
});

export type CreateEventsDto = z.infer<typeof createEventsDto>;
