import '@tanstack/react-start/server-only';
import { z } from '@hono/zod-openapi';
import { PartOfSpeech } from '@/const/vocabulary';

export const generatedVocabularyItemDto = z.object({
  value: z.string().max(255),
  definition: z.string().max(512),
  uaTranslation: z.string().max(255),
  partOfSpeech: z.enum(PartOfSpeech).nullable(),
  spelling: z.string().max(255),
});

export type GeneratedVocabularyItemDto = z.infer<typeof generatedVocabularyItemDto>;
