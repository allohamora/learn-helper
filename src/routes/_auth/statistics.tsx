import { createFileRoute } from '@tanstack/react-router';
import { routeHead } from '@/utils/route';
import { StatisticsPage } from '@/features/statistics/pages/statistics-page';

export const Route = createFileRoute('/_auth/statistics')({
  head: () => routeHead('Statistics'),
  component: StatisticsPage,
});
