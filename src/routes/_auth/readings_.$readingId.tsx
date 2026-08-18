import { createFileRoute } from '@tanstack/react-router';
import { getIsomorphicAppClient } from '@/services/api';
import { PdfReader } from '@/components/pdf-reader';
import { pageHead } from '@/utils/page';

export const Route = createFileRoute('/_auth/readings_/$readingId')({
  loader: async ({ params: { readingId } }) => {
    const app = await getIsomorphicAppClient();
    const res = await app.api.v1.users.me.readings[':readingId'].$get({ param: { readingId } });
    if (!res.ok) throw new Error('Failed to load reading');

    const body = await res.json();
    return body.data;
  },
  head: ({ loaderData }) => pageHead(loaderData?.title ?? 'Reading'),
  component: ReadingPage,
});

function ReadingPage() {
  const reading = Route.useLoaderData();

  return <PdfReader key={reading.id} readingId={reading.id} totalPages={reading.totalPages} />;
}
