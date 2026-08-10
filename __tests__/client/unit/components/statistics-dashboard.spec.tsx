import type { ComponentProps } from 'react';
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { StatisticsDashboard } from '@/components/statistics-dashboard';
import { PartOfSpeech } from '@/const/vocabulary';

type StatisticsData = ComponentProps<typeof StatisticsDashboard>['data'];

const statisticsData = {
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
    totalWordsGenerated: 9,
    totalAiCostsInNanoDollars: 1_500_000_000,
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

describe('StatisticsDashboard', () => {
  let getBoundingClientRectSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    // happy-dom has no layout engine, so getBoundingClientRect() always reports 0x0,
    // which makes Recharts' ResponsiveContainer warn about a non-positive container size.
    getBoundingClientRectSpy = vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockReturnValue({
      width: 320,
      height: 200,
      top: 0,
      left: 0,
      right: 320,
      bottom: 200,
      x: 0,
      y: 0,
      toJSON() {},
    } as DOMRect);
  });

  afterEach(() => {
    getBoundingClientRectSpy.mockRestore();
    cleanup();
  });

  it('renders the migrated metrics, charts, and ranked vocabulary', () => {
    render(<StatisticsDashboard data={statisticsData} isPhoneScreen={false} />);

    expect(screen.getByText('Discovery Undos')).toBeTruthy();
    expect(screen.getByText('discoveries reverted')).toBeTruthy();
    expect(screen.getByText('Word Discovery')).toBeTruthy();
    expect(screen.getByText('Learning Activity')).toBeTruthy();
    expect(screen.getByText('AI Cost')).toBeTruthy();
    expect(screen.getByText('Task Cost')).toBeTruthy();
    expect(screen.getByText('Words Generated')).toBeTruthy();
    expect(screen.getByText('Most Mistaken Words')).toBeTruthy();
    expect(screen.getByText('example')).toBeTruthy();
    expect(screen.getByText('Most Hinted Words')).toBeTruthy();
    expect(screen.getByText('practice')).toBeTruthy();
    expect(getBoundingClientRectSpy).toHaveBeenCalled();
  });

  it('renders both ranked-table empty states', () => {
    render(
      <StatisticsDashboard data={{ ...statisticsData, topMistakes: [], topHintedWords: [] }} isPhoneScreen={true} />,
    );

    expect(screen.getByText('No mistakes recorded yet. Keep practicing!')).toBeTruthy();
    expect(screen.getByText('No hints viewed yet. Try using hints when you need help!')).toBeTruthy();
    expect(getBoundingClientRectSpy).toHaveBeenCalled();
  });
});
