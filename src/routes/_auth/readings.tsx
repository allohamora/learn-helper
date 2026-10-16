import { createFileRoute } from '@tanstack/react-router';
import { routeHead } from '@/utils/route';
import { ReadingsPage } from '@/features/reading/pages/readings-page';

export const Route = createFileRoute('/_auth/readings')({
  head: () => routeHead('Readings'),
  component: ReadingsPage,
});
