import '@tanstack/react-start/server-only';
import { z } from '@hono/zod-openapi';
import { LearningStatus } from '@/const/vocabulary';
import { vocabularyItemDto } from '../../vocabulary/dtos/vocabulary-item.dto';

export const userVocabularyItemLearningDto = z.object({
  id: z.uuidv7(),
  userId: z.string(),
  vocabularyItemId: z.uuidv7(),
  encounterCount: z.number(),
  status: z.enum(LearningStatus),
  enqueuedAt: z.iso.datetime(),
  createdAt: z.iso.datetime(),
  updatedAt: z.iso.datetime(),
  vocabularyItem: vocabularyItemDto,
});
