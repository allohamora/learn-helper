import '@tanstack/react-start/server-only';
import { z } from '@hono/zod-openapi';

export const userVocabularyListProgressDto = z.object({
  title: z.string(),
  total: z.number(),
  waiting: z.number(),
  learning: z.number(),
  learned: z.number(),
  known: z.number(),
});
