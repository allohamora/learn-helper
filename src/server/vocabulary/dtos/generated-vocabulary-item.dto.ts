import '@tanstack/react-start/server-only';
import { z } from '@hono/zod-openapi';
import { PartOfSpeech } from '@/const/vocabulary';

export const generatedVocabularyItemDto = z.object({
  value: z.string().trim().min(1).max(255),
  definition: z.string().trim().min(1).max(512),
  uaTranslation: z.string().trim().min(1).max(255),
  partOfSpeech: z.enum(PartOfSpeech).nullable(),
  spelling: z.string().trim().min(1).max(255),
});

export type GeneratedVocabularyItemDto = z.infer<typeof generatedVocabularyItemDto>;
