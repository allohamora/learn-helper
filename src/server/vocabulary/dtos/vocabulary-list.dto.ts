import '@tanstack/react-start/server-only';
import { z } from '@hono/zod-openapi';

export const vocabularyListDto = z.object({
  id: z.uuidv7(),
  title: z.string(),
  createdAt: z.iso.datetime(),
  updatedAt: z.iso.datetime(),
});
