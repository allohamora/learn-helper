import '@tanstack/react-start/server-only';
import { z } from '@hono/zod-openapi';
import { LearningStatus } from '@/const/vocabulary';
import { RequestType } from '@/const/request';

export const vocabularyListItemSchema = z.object({
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

export const vocabularyListItemsQuerySchema = z.object({
  status: z.enum(LearningStatus).optional(),
  search: z.string().trim().min(1).max(255).optional(),
  cursor: z.uuidv7().optional(),
  limit: z.coerce.number().int().min(1).max(100).optional(),
  type: z.enum(RequestType).optional(),
});

export type VocabularyListItemsQuery = z.infer<typeof vocabularyListItemsQuerySchema>;
