import type { ComponentProps } from 'react';
import { StatisticsDashboard } from '@/components/statistics-dashboard';
import { PartOfSpeech } from '@/const/vocabulary';

type StatisticsData = ComponentProps<typeof StatisticsDashboard>['data'];

export const statisticsData = {
  general: {
    totalDiscoveredWords: 10,
    totalDiscoveryUndos: 2,
    totalMistakesMade: 3,
    totalCompletedTasks: 20,
    totalRetriesCompleted: 4,
    totalShowcasesCompleted: 5,
    totalWordsMovedToNextStep: 6,
    totalHintsViewed: 7,
    totalWordsUpdated: 8,
    totalTaskCostsInNanoDollars: 1_500_000_000,
    totalInputTokens: 1_000,
    totalOutputTokens: 500,
    totalLearningDurationMs: 3_661_000,
    totalDiscoveringDurationMs: 120_000,
    averageTimePerTaskMs: 15_000,
    averageTimePerDiscoveryMs: 12_000,
  },
  discoveringPerDay: [{ date: '2026-07-24', learningCount: 2, knownCount: 1, durationMs: 90_000 }],
  learningPerDay: [
    {
      date: '2026-07-24',
      completedTasks: 4,
      completedRetries: 1,
      completedShowcases: 1,
      mistakesMade: 2,
      hintsViewed: 3,
      durationMs: 150_000,
    },
  ],
  costPerDay: [{ date: '2026-07-24', costInNanoDollars: 500_000_000, inputTokens: 100, outputTokens: 50 }],
  wordsUpdatedPerDay: [{ date: '2026-07-24', uaTranslation: 2 }],
  topMistakes: [{ count: 4, value: 'example', partOfSpeech: PartOfSpeech.Noun }],
  topHintedWords: [{ count: 3, value: 'practice', partOfSpeech: PartOfSpeech.Verb }],
} satisfies StatisticsData;
