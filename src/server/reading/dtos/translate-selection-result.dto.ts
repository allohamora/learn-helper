import '@tanstack/react-start/server-only';
import { z } from '@hono/zod-openapi';

export const translateSelectionResultDto = z.object({
  uaTranslation: z.string().trim().min(1),
  canAddToLearningList: z.boolean(),
});

export type TranslateSelectionResultDto = z.infer<typeof translateSelectionResultDto>;
