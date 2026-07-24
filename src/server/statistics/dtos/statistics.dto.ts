import '@tanstack/react-start/server-only';
import { z } from '@hono/zod-openapi';
import { PartOfSpeech } from '@/const/vocabulary';

const date = z.iso.date();

const generalStatisticsDto = z.object({
  totalDiscoveredWords: z.number().int(),
  totalMistakesMade: z.number().int(),
  totalCompletedTasks: z.number().int(),
  totalRetriesCompleted: z.number().int(),
  totalShowcasesCompleted: z.number().int(),
  totalWordsMovedToNextStep: z.number().int(),
  totalHintsViewed: z.number().int(),
  totalWordsUpdated: z.number().int(),
  totalTaskCostsInNanoDollars: z.number(),
  totalInputTokens: z.number().int(),
  totalOutputTokens: z.number().int(),
  totalLearningDurationMs: z.number().int(),
  totalDiscoveringDurationMs: z.number().int(),
  averageTimePerTaskMs: z.number().int(),
  averageTimePerDiscoveryMs: z.number().int(),
});

const discoveringPerDayStatisticsDto = z.object({
  date,
  learningCount: z.number().int(),
  knownCount: z.number().int(),
  durationMs: z.number().int(),
});

const learningPerDayStatisticsDto = z.object({
  date,
  completedTasks: z.number().int(),
  completedRetries: z.number().int(),
  completedShowcases: z.number().int(),
  mistakesMade: z.number().int(),
  hintsViewed: z.number().int(),
  durationMs: z.number().int(),
});

const costPerDayStatisticsDto = z.object({
  date,
  costInNanoDollars: z.number(),
  inputTokens: z.number().int(),
  outputTokens: z.number().int(),
});

const wordsUpdatedPerDayStatisticsDto = z.object({
  date,
  uaTranslation: z.number().int(),
});

const topVocabularyItemStatisticsDto = z.object({
  count: z.number().int(),
  value: z.string(),
  partOfSpeech: z.enum(PartOfSpeech).nullable(),
});

export const statisticsDto = z.object({
  general: generalStatisticsDto,
  discoveringPerDay: z.array(discoveringPerDayStatisticsDto),
  learningPerDay: z.array(learningPerDayStatisticsDto),
  costPerDay: z.array(costPerDayStatisticsDto),
  wordsUpdatedPerDay: z.array(wordsUpdatedPerDayStatisticsDto),
  topMistakes: z.array(topVocabularyItemStatisticsDto),
  topHintedWords: z.array(topVocabularyItemStatisticsDto),
});

export type Statistics = z.infer<typeof statisticsDto>;
export type DiscoveringPerDayStatistics = z.infer<typeof discoveringPerDayStatisticsDto>;
export type LearningPerDayStatistics = z.infer<typeof learningPerDayStatisticsDto>;
export type CostPerDayStatistics = z.infer<typeof costPerDayStatisticsDto>;
export type WordsUpdatedPerDayStatistics = z.infer<typeof wordsUpdatedPerDayStatisticsDto>;
