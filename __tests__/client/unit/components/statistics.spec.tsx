import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Statistics } from '@/components/statistics';
import { statisticsData } from '../../fixtures/statistics.fixture';

const { getStatisticsMock } = vi.hoisted(() => ({
  getStatisticsMock: vi.fn(),
}));

vi.mock('@/services/api', () => ({
  appClient: {
    api: {
      v1: {
        users: {
          me: {
            statistics: {
              $get: getStatisticsMock,
            },
          },
        },
      },
    },
  },
}));

describe('Statistics', () => {
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
    cleanup();
  });

  beforeEach(() => {
    getStatisticsMock.mockReset();
    window.matchMedia = vi.fn().mockReturnValue({
      matches: false,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    });
  });

  it('loads statistics using the browser timezone', async () => {
    getStatisticsMock.mockResolvedValue({
      ok: true,
      json: async () => ({ success: true, data: statisticsData }),
    });

    renderStatistics();

    expect(screen.getByText('Loading...')).toBeTruthy();
    expect(await screen.findByText('Discovery Undos')).toBeTruthy();
    expect(getStatisticsMock).toHaveBeenCalledWith({
      query: {
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      },
    });
  });

  it('shows an API error and retries the request', async () => {
    getStatisticsMock
      .mockResolvedValueOnce({
        ok: false,
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true, data: statisticsData }),
      });

    renderStatistics();

    fireEvent.click(await screen.findByRole('button', { name: 'Try Again' }));

    expect(await screen.findByText('Discovery Undos')).toBeTruthy();
    expect(getStatisticsMock).toHaveBeenCalledTimes(2);
  });
});
