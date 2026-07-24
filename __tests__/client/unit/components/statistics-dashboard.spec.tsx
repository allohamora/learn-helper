import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { StatisticsDashboard } from '@/components/statistics-dashboard';
import { statisticsData } from '../../fixtures/statistics.fixture';

describe('StatisticsDashboard', () => {
  afterEach(() => {
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
  });

  it('renders both ranked-table empty states', () => {
    render(
      <StatisticsDashboard data={{ ...statisticsData, topMistakes: [], topHintedWords: [] }} isPhoneScreen={true} />,
    );

    expect(screen.getByText('No mistakes recorded yet. Keep practicing!')).toBeTruthy();
    expect(screen.getByText('No hints viewed yet. Try using hints when you need help!')).toBeTruthy();
  });
});
