import { createFileRoute } from '@tanstack/react-router';
import { pageHead } from '@/utils/page';
import { ReadingsPage } from '@/features/reading/pages/readings-page';

export const Route = createFileRoute('/_auth/readings')({
  head: () => pageHead('Readings'),
  component: ReadingsPage,
});
