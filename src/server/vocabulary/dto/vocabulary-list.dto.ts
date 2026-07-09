import '@tanstack/react-start/server-only';
import { z } from '@hono/zod-openapi';

export const vocabularyListSchema = z.object({
  id: z.uuid(),
  title: z.string(),
  addedAt: z.iso.datetime().nullable(),
});
