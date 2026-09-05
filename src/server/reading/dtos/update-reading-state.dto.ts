import '@tanstack/react-start/server-only';
import { z } from '@hono/zod-openapi';

export const updateReadingStateDto = z.object({
  currentPage: z.number().int().min(1),
  addDurationMs: z.number().int().min(0),
});

export type UpdateReadingStateDto = z.infer<typeof updateReadingStateDto>;
