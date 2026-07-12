import '@tanstack/react-start/server-only';
import { z } from '@hono/zod-openapi';

export const userAvailableVocabularyListSchema = z.object({
  id: z
    .uuidv7()
    .nullable()
    .openapi({ description: "The user's enrollment id for this list, null if the user has not added it" }),
  vocabularyListId: z.uuidv7(),
  title: z.string(),
  addedAt: z.iso.datetime().nullable(),
});
