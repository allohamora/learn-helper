import '@tanstack/react-start/server-only';
import { z } from '@hono/zod-openapi';

export const fileDto = z.object({
  id: z.uuidv7(),
  fileName: z.string(),
  mimeType: z.string(),
  sizeBytes: z.number().int(),
});
