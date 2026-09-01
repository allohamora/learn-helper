import '@tanstack/react-start/server-only';
import { z } from '@hono/zod-openapi';

export const translateSelectionDto = z.object({
  // mirrors MAX_SELECTION_LENGTH in src/components/translation-popover.tsx
  text: z.string().trim().min(1).max(400),
  // mirrors CONTEXT_CHARS in src/utils/selection.ts
  before: z.string().trim().max(200).nullable().optional(),
  after: z.string().trim().max(200).nullable().optional(),
});

export type TranslateSelectionDto = z.infer<typeof translateSelectionDto>;
