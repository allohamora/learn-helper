import '@tanstack/react-start/server-only';
import { z } from '@hono/zod-openapi';

export const userVocabularyItemTaskDto = z.object({
  id: z.uuidv7(),
  sentence: z.string(),
  translation: z.string(),
});

export const userVocabularyListLearningTasksDto = z.object({
  translateEnglishSentenceTasks: z.array(userVocabularyItemTaskDto),
  translateUkrainianSentenceTasks: z.array(userVocabularyItemTaskDto),
});
