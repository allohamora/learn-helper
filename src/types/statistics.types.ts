export type DiscoveringPerDayStatistics = {
  date: string; // YYYY-MM-DD
  learningCount: number;
  knownCount: number;
  durationMs: number;
};

export type LearningPerDayStatistics = {
  date: string; // YYYY-MM-DD
  completedTasks: number;
  completedRetries: number;
  completedShowcases: number;
  mistakesMade: number;
  hintsViewed: number;
  durationMs: number;
};

export type CostPerDayStatistics = {
  date: string; // YYYY-MM-DD
  costInNanoDollars: number;
  inputTokens: number;
  outputTokens: number;
};

export type WordUpdatedPerDayStatistics = {
  date: string; // YYYY-MM-DD
  uaTranslation: number;
};

export type Statistics = {
  general: {
    totalDiscoveredWords: number;
    totalMistakesMade: number;
    totalCompletedTasks: number;
    totalRetriesCompleted: number;
    totalShowcasesCompleted: number;
    totalWordsMovedToNextStep: number;
    totalHintsViewed: number;
    totalWordsUpdated: number;
    totalTaskCostsInNanoDollars: number;
    totalInputTokens: number;
    totalOutputTokens: number;

    totalLearningDurationMs: number;
    totalDiscoveringDurationMs: number;

    averageTimePerTaskMs: number;
    averageTimePerDiscoveryMs: number;
  };
  discoveringPerDay: DiscoveringPerDayStatistics[];
  learningPerDay: LearningPerDayStatistics[];
  costPerDay: CostPerDayStatistics[];
  wordsUpdatedPerDay: WordUpdatedPerDayStatistics[];
  topMistakes: {
    count: number;
    value: string | null;
    partOfSpeech: string | null;
  }[];
  topHintedWords: {
    count: number;
    value: string | null;
    partOfSpeech: string | null;
  }[];
};
