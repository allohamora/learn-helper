import '@tanstack/react-start/server-only';
import { z } from '@hono/zod-openapi';

export const generateVocabularyItemDto = z.object({
  value: z.string().trim().min(1).max(255),
  context: z.string().trim().max(512).optional(),
});

export type GenerateVocabularyItemDto = z.infer<typeof generateVocabularyItemDto>;
