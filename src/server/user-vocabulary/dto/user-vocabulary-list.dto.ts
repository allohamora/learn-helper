import '@tanstack/react-start/server-only';
import { z } from '@hono/zod-openapi';

export const userVocabularyListDto = z.object({
  id: z.uuidv7(),
  userId: z.string(),
  vocabularyListId: z.uuidv7(),
  createdAt: z.iso.datetime(),
});
