import '@tanstack/react-start/server-only';
import { z } from '@hono/zod-openapi';
import { RequestType } from '@/const/request';
import { LearningStatus } from '@/const/vocabulary';

export const userVocabularyListItemsFilterDto = z.object({
  status: z.enum(LearningStatus).optional(),
  search: z.string().trim().min(1).max(255).optional(),
  cursor: z.uuidv7().optional(),
  limit: z.coerce.number().int().min(1).max(100).optional(),
  type: z.enum(RequestType).optional(),
});

export type UserVocabularyListItemsFilterDto = z.infer<typeof userVocabularyListItemsFilterDto>;
