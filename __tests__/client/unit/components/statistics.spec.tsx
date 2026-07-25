import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { HttpResponse } from 'msw';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Statistics } from '@/components/statistics';
import { statisticsData } from '../../fixtures/statistics.fixture';
import { api } from '../../utils/api.utils';
import { mockServer } from '../../setup-unit-context';

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
    window.matchMedia = vi.fn().mockReturnValue({
      matches: false,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    });
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
  });
});
