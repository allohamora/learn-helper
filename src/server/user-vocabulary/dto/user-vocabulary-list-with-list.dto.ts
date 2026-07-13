import '@tanstack/react-start/server-only';
import { z } from '@hono/zod-openapi';
import { userVocabularyListDto } from './user-vocabulary-list.dto';

export const userVocabularyListWithListDto = userVocabularyListDto.extend({
  vocabularyList: z.object({
    id: z.uuidv7(),
    title: z.string(),
    createdAt: z.iso.datetime(),
    updatedAt: z.iso.datetime(),
  }),
});
