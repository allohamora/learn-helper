import type { ComponentProps } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { HttpResponse } from 'msw';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Statistics } from '@/components/statistics';
import { StatisticsDashboard } from '@/components/statistics-dashboard';
import { PartOfSpeech } from '@/const/vocabulary';
import { api } from '../../utils/api.utils';
import { mockServer } from '../../setup-unit-context';

type StatisticsData = ComponentProps<typeof StatisticsDashboard>['data'];

const statisticsData = {
  general: {
    totalDiscoveredItems: 10,
    totalDiscoveryUndos: 2,
    totalMistakesMade: 3,
    totalCompletedTasks: 20,
    totalRetriesCompleted: 4,
    totalShowcasesCompleted: 5,
    totalItemsMovedToNextStep: 6,
    totalHintsViewed: 7,
    totalItemsUpdated: 8,
    totalItemsGenerated: 9,
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
  itemsUpdatedPerDay: [{ date: '2026-07-24', uaTranslation: 2 }],
  topMistakes: [{ count: 4, value: 'example', partOfSpeech: PartOfSpeech.Noun }],
  topHintedItems: [{ count: 3, value: 'practice', partOfSpeech: PartOfSpeech.Verb }],
} satisfies StatisticsData;

describe('Statistics', () => {
  let getBoundingClientRectSpy: ReturnType<typeof vi.spyOn>;
  let matchMediaSpy: ReturnType<typeof vi.spyOn>;

  const renderStatistics = () => {
    const queryClient = new QueryClient({
      defaultOptions: {
        queries: {
          retry: false,
        },
      },
    });

    return render(
      <QueryClientProvider client={queryClient}>
        <Statistics />
      </QueryClientProvider>,
    );
  };

  afterEach(() => {
    matchMediaSpy.mockRestore();
    getBoundingClientRectSpy.mockRestore();
    cleanup();
  });

  beforeEach(() => {
    matchMediaSpy = vi.spyOn(window, 'matchMedia').mockReturnValue({
      matches: false,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    } as unknown as MediaQueryList);

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

  it('loads statistics using the browser timezone', async () => {
    const getStatistics = vi.fn((searchParams: URLSearchParams) => {
      expect(searchParams.get('timezone')).toBe(Intl.DateTimeFormat().resolvedOptions().timeZone);

      return HttpResponse.json({ success: true, data: statisticsData });
    });
    mockServer.addHandlers(api.statistics.mock(getStatistics));

    renderStatistics();

    expect(screen.getByText('Loading...')).toBeTruthy();
    expect(await screen.findByText('Discovery Undos')).toBeTruthy();
    expect(getStatistics).toHaveBeenCalledOnce();
    expect(getBoundingClientRectSpy).toHaveBeenCalled();
  });

  it('shows an API error and retries the request', async () => {
    const getStatistics = vi
      .fn()
      .mockReturnValueOnce(HttpResponse.json(null, { status: 500 }))
      .mockReturnValueOnce(HttpResponse.json({ success: true, data: statisticsData }));
    mockServer.addHandlers(api.statistics.mock(getStatistics));

    renderStatistics();

    fireEvent.click(await screen.findByRole('button', { name: 'Try Again' }));

    expect(await screen.findByText('Discovery Undos')).toBeTruthy();
    expect(getStatistics).toHaveBeenCalledTimes(2);
    expect(getBoundingClientRectSpy).toHaveBeenCalled();
  });
});
