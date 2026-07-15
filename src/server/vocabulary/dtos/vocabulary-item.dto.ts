import '@tanstack/react-start/server-only';
import { z } from '@hono/zod-openapi';

export const vocabularyItemDto = z.object({
  id: z.uuidv7(),
  value: z.string(),
  definition: z.string(),
  uaTranslation: z.string(),
  partOfSpeech: z.string().nullable(),
  spelling: z.string(),
  pronunciation: z.string().nullable(),
  link: z.string().nullable(),
  createdAt: z.iso.datetime(),
  updatedAt: z.iso.datetime(),
});
