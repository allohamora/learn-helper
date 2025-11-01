export type DiscoveringPerDayStatistics = {
  date: string; // YYYY-MM-DD
  learningCount: number;
  knownCount: number;
};

export type LearningPerDayStatistics = {
  date: string; // YYYY-MM-DD
  completedTasks: number;
  completedRetries: number;
  mistakesMade: number;
  durationMs: number;
};

export type Statistics = {
  general: {
    totalDiscoveredWords: number;
    totalMistakesMade: number;
    totalCompletedTasks: number;
    totalWordsMovedToNextStep: number;

    totalLearningDurationMs: number;
    averageTimePerTaskMs: number;
  };
  discoveringPerDay: DiscoveringPerDayStatistics[];
  learningPerDay: LearningPerDayStatistics[];
  topMistakes: {
    count: number;
    value: string | null;
    partOfSpeech: string | null;
  }[];
};
