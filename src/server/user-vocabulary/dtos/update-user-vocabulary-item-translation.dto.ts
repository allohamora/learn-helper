import '@tanstack/react-start/server-only';
import { z } from '@hono/zod-openapi';

export const updateUserVocabularyItemTranslationDto = z.object({
  uaTranslation: z.string().trim().min(1).max(255),
});

export type UpdateUserVocabularyItemTranslationDto = z.infer<typeof updateUserVocabularyItemTranslationDto>;
