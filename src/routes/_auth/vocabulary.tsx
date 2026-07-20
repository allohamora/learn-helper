import { createFileRoute } from '@tanstack/react-router';
import { getIsomorphicAppClient } from '@/services/api';
import { VocabularyListRow } from '@/components/vocabulary-list-row';
import { pageHead } from '@/utils/page';

export const Route = createFileRoute('/_auth/vocabulary')({
  head: () => pageHead('Vocabulary'),
  loader: async () => {
    const app = await getIsomorphicAppClient();
    const res = await app.api.v1.users.me['vocabulary-lists'].available.$get();
    if (!res.ok) throw new Error('Failed to load vocabulary lists');

    const body = await res.json();
    return body.data;
  },
  component: VocabularyPage,
});

function VocabularyPage() {
  const lists = Route.useLoaderData();

  return (
    <>
      <div className="flex flex-col items-center px-4 pt-4 text-center md:pt-8">
        <h1 className="text-2xl font-bold tracking-tight md:text-4xl">Vocabulary</h1>
      </div>

      <div className="px-4 pt-6">
        {lists.length === 0 ? (
          <p className="py-8 text-center text-sm text-muted-foreground">No vocabulary lists available.</p>
        ) : (
          <div className="mx-auto max-w-2xl divide-y overflow-hidden rounded-lg border text-left">
            {lists.map((list) => (
              <VocabularyListRow key={list.id} {...list} />
            ))}
          </div>
        )}
      </div>
    </>
  );
}
