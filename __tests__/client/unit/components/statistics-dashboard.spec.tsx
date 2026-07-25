import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { StatisticsDashboard } from '@/components/statistics-dashboard';
import { statisticsData } from '../../fixtures/statistics.fixture';

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
    expect(screen.getAllByText('Task Cost')).toHaveLength(2);
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
