import '@tanstack/react-start/server-only';
import { z } from '@hono/zod-openapi';
import { fileDto } from './file.dto';

export const readingWithRelationsDto = z.object({
  id: z.uuidv7(),
  userId: z.string(),
  fileId: z.uuidv7(),
  title: z.string(),
  totalPages: z.number().int(),
  currentPage: z.number().int(),
  durationMs: z.number().int(),
  createdAt: z.iso.datetime(),
  updatedAt: z.iso.datetime(),
  file: fileDto,
});
