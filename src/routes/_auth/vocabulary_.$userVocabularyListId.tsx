import { useInfiniteQuery } from '@tanstack/react-query';
import { createFileRoute, Link } from '@tanstack/react-router';
import { ArrowLeft } from 'lucide-react';
import { z } from 'zod';
import { appClient, getIsomorphicAppClient } from '@/services/api';
import { VocabularyListFilters } from '@/components/vocabulary-list-filters';
import { VocabularyItemsTable } from '@/components/vocabulary-items-table';
import { VocabularyListProgress } from '@/components/vocabulary-list-progress';
import { LearningStatus } from '@/const/vocabulary';
import { RequestType } from '@/const/request';

const vocabularyListSearchSchema = z.object({
  status: z.enum(LearningStatus).optional(),
  search: z.string().trim().min(1).max(255).optional(),
});

export const Route = createFileRoute('/_auth/vocabulary_/$userVocabularyListId')({
  validateSearch: vocabularyListSearchSchema,
  loader: async ({ params: { userVocabularyListId } }) => {
    const app = await getIsomorphicAppClient();
    const res = await app.api.v1.users.me['vocabulary-lists'][':userVocabularyListId'].$get({
      param: { userVocabularyListId },
    });
    if (!res.ok) throw new Error('Failed to load vocabulary list');

    const body = await res.json();
    return body.data;
  },
  component: VocabularyListDetailPage,
});

function VocabularyListDetailPage() {
  const { userVocabularyListId } = Route.useParams();
  const { status, search } = Route.useSearch();
  const userVocabularyList = Route.useLoaderData();

  const { data, isPending, isFetchingNextPage, hasNextPage, fetchNextPage } = useInfiniteQuery({
    queryKey: ['vocabulary-list-items', userVocabularyListId, status, search],
    queryFn: async ({ pageParam }) => {
      const res = await appClient.api.v1.users.me['vocabulary-lists'][':userVocabularyListId'].items.$get({
        param: { userVocabularyListId },
        query: { status, search, cursor: pageParam, type: RequestType.All },
      });
      if (!res.ok) throw new Error('Failed to load vocabulary list items');

      return res.json();
    },
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (lastPage) => lastPage.pageInfo.nextCursor,
  });

  const items = data?.pages.flatMap((page) => page.data) ?? [];

  return (
    <div className="mx-auto max-w-6xl px-4 py-6">
      <Link
        to="/vocabulary"
        className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="size-4" />
        Back to vocabulary
      </Link>

      <h1 className="mt-2 text-2xl font-bold tracking-tight md:text-3xl">{userVocabularyList.vocabularyList.title}</h1>

      <div className="mt-4">
        <VocabularyListProgress userVocabularyListId={userVocabularyListId} />
      </div>

      <div className="mt-6">
        <VocabularyListFilters />
      </div>

      <div className="mt-4 overflow-hidden rounded-lg border">
        {isPending ? (
          <p className="py-8 text-center text-sm text-muted-foreground">Loading…</p>
        ) : (
          <VocabularyItemsTable
            items={items}
            hasNextPage={hasNextPage}
            isFetchingNextPage={isFetchingNextPage}
            onLoadMore={() => void fetchNextPage()}
          />
        )}
      </div>
    </div>
  );
}
