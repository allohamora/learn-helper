import '@tanstack/react-start/server-only';
import { z } from '@hono/zod-openapi';

export const removeVocabularyItemFromListDto = z.object({
  isReset: z.boolean().default(false),
});

export type RemoveVocabularyItemFromListDto = z.infer<typeof removeVocabularyItemFromListDto>;
