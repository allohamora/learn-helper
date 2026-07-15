import '@tanstack/react-start/server-only';
import { z } from '@hono/zod-openapi';

export const userVocabularyItemTranslationDto = z.object({
  userVocabularyItemId: z.uuidv7(),
  uaTranslation: z.string(),
});
