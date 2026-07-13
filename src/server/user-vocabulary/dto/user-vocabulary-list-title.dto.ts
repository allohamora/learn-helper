import '@tanstack/react-start/server-only';
import { z } from '@hono/zod-openapi';

export const userVocabularyListTitleDto = z.object({
  id: z.uuidv7(),
  title: z.string(),
});
