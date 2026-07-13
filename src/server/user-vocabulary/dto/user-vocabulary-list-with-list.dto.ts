import '@tanstack/react-start/server-only';
import { z } from '@hono/zod-openapi';

export const userVocabularyListWithListDto = z.object({
  id: z.uuidv7(),
  userId: z.string(),
  vocabularyListId: z.uuidv7(),
  createdAt: z.iso.datetime(),
  vocabularyList: z.object({
    id: z.uuidv7(),
    title: z.string(),
    createdAt: z.iso.datetime(),
    updatedAt: z.iso.datetime(),
  }),
});
