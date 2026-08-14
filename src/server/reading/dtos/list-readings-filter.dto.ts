import '@tanstack/react-start/server-only';
import { z } from '@hono/zod-openapi';
import { RequestType } from '@/const/request';

export const listReadingsFilterDto = z.object({
  cursor: z.uuidv7().optional(),
  limit: z.coerce.number().int().min(1).max(100).optional(),
  type: z.enum(RequestType).optional(),
});

export type ListReadingsFilterDto = z.infer<typeof listReadingsFilterDto>;
