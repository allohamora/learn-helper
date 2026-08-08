import '@tanstack/react-start/server-only';
import { z } from '@hono/zod-openapi';
import { VocabularyListType } from '@/const/vocabulary';

export const vocabularyListDto = z.object({
  id: z.uuidv7(),
  title: z.string().nullable(),
  type: z.enum(VocabularyListType),
  createdAt: z.iso.datetime(),
  updatedAt: z.iso.datetime(),
});
