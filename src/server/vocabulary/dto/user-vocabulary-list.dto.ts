import { z } from '@hono/zod-openapi';

export const userVocabularyListSchema = z.object({
  id: z.uuid(),
  userId: z.string(),
  vocabularyListId: z.uuid(),
  createdAt: z.iso.datetime(),
});
