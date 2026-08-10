import '@tanstack/react-start/server-only';
import { z } from '@hono/zod-openapi';
import { RequestType } from '@/const/request';

export const vocabularyItemFilterDto = z.object({
  value: z.string().trim().min(1).max(255),
  cursor: z.uuidv7().optional(),
  limit: z.coerce.number().int().min(1).max(50).optional(),
  type: z.enum(RequestType).optional(),
});

export type VocabularyItemFilterDto = z.infer<typeof vocabularyItemFilterDto>;
