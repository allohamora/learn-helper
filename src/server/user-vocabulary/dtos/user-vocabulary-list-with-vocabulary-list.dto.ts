import '@tanstack/react-start/server-only';
import { z } from '@hono/zod-openapi';
import { vocabularyListDto } from '../../vocabulary/dtos/vocabulary-list.dto';

export const userVocabularyListWithVocabularyListDto = z.object({
  id: z.uuidv7(),
  userId: z.string(),
  vocabularyListId: z.uuidv7(),
  createdAt: z.iso.datetime(),
  vocabularyList: vocabularyListDto,
});
