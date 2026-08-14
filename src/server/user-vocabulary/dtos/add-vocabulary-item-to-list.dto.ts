import '@tanstack/react-start/server-only';
import { z } from '@hono/zod-openapi';

export const addVocabularyItemToListDto = z.object({
  vocabularyItemId: z.uuidv7(),
  isResetToLearning: z.boolean().default(true),
});

export type AddVocabularyItemToListDto = z.infer<typeof addVocabularyItemToListDto>;
