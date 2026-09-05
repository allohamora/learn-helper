import { createFileRoute } from '@tanstack/react-router';
import { apiRequest, getIsomorphicAppClient } from '@/services/api';
import { PdfReader } from '@/components/pdf-reader';
import { pageHead } from '@/utils/page';

export const Route = createFileRoute('/_auth/readings_/$readingId')({
  loader: {
    handler: async ({ params: { readingId } }) => {
      const app = await getIsomorphicAppClient();

      return apiRequest(
        () => app.api.v1.users.me.readings[':readingId'].$get({ param: { readingId } }),
        'Failed to load reading',
      );
    },
    // The router's default background-reload mode renders the cached (possibly stale) currentPage
    // from a prior visit immediately, then patches it in later - which the reader has no way to
    // react to (it only seeds its page state once, on mount). Blocking here means re-entering the
    // reader always shows the true resume page, never a stale one.
    staleReloadMode: 'blocking',
  },
  head: ({ loaderData }) => pageHead(loaderData?.title ?? 'Reading'),
  component: ReadingPage,
});

function ReadingPage() {
  const reading = Route.useLoaderData();

  return (
    <PdfReader
      key={reading.id}
      readingId={reading.id}
      totalPages={reading.totalPages}
      initialPage={reading.currentPage}
    />
  );
}
