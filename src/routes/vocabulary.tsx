import { createServerFn } from '@tanstack/react-start';
import { createFileRoute } from '@tanstack/react-router';
import { requireAuth, requireSession } from '@/server/auth/auth.session';
import { getAvailableVocabularyLists } from '@/server/vocabulary/vocabulary-list.repository';
import { PageLayout } from '@/components/page-layout';
import { VocabularyListRow } from '@/components/vocabulary-list-row';

const getVocabularyListsForCurrentUser = createServerFn({ method: 'GET' }).handler(async () => {
  const { user } = await requireSession();

  return getAvailableVocabularyLists(user.id);
});

export const Route = createFileRoute('/vocabulary')({
  beforeLoad: requireAuth,
  loader: () => getVocabularyListsForCurrentUser(),
  component: VocabularyPage,
});

function VocabularyPage() {
  const lists = Route.useLoaderData();

  return (
    <PageLayout>
      <div className="flex flex-col items-center px-4 pt-4 text-center md:pt-8">
        <h1 className="text-2xl font-bold tracking-tight md:text-4xl">Vocabulary</h1>
      </div>

      <div className="px-4 pt-6">
        <div className="mx-auto max-w-2xl divide-y overflow-hidden rounded-lg border text-left">
          {lists.map((list) => (
            <VocabularyListRow key={list.id} {...list} />
          ))}
        </div>
      </div>
    </PageLayout>
  );
}
