import { createFileRoute } from '@tanstack/react-router';
import { pageHead } from '@/utils/page';
import { StatisticsPage } from '@/features/statistics/pages/statistics-page';

export const Route = createFileRoute('/_auth/statistics')({
  head: () => pageHead('Statistics'),
  component: StatisticsPage,
});
