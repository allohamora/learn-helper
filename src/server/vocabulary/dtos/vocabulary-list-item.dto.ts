import '@tanstack/react-start/server-only';
import { z } from '@hono/zod-openapi';

export const vocabularyListItemDto = z.object({
  id: z.uuidv7(),
  vocabularyListId: z.uuidv7(),
  vocabularyItemId: z.uuidv7(),
  createdAt: z.iso.datetime(),
});
