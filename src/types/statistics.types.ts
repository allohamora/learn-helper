export type DiscoveringPerDayStatistics = {
  date: string; // YYYY-MM-DD
  learningCount: number;
  knownCount: number;
  durationMs: number;
};

export type Statistics = {
  general: {
    totalDiscoveredWords: number;
    totalWordsMovedToNextStep: number;
    totalDiscoveringDurationMs: number;
    averageTimePerDiscoveryMs: number;
  };
  discoveringPerDay: DiscoveringPerDayStatistics[];
};
