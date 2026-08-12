import { useInfiniteQuery } from '@tanstack/react-query';
import { createFileRoute } from '@tanstack/react-router';
import { z } from 'zod';
import { appClient, getIsomorphicAppClient } from '@/services/api';
import { EditVocabularyItemTranslationDialog } from '@/components/edit-vocabulary-item-translation-dialog';
import { EditVocabularyItemTranslationProvider } from '@/components/providers/edit-vocabulary-item-translation';
import { AddPersonalVocabularyItemDialog } from '@/components/add-personal-vocabulary-item-dialog';
import { VocabularyListFilters } from '@/components/vocabulary-list-filters';
import { VocabularyItemsTable } from '@/components/vocabulary-items-table';
import { VocabularyListProgress } from '@/components/vocabulary-list-progress';
import { Loader } from '@/components/ui/loader';
import { LearningStatus, VocabularyListType } from '@/const/vocabulary';
import { RequestType } from '@/const/request';
import { pageHead } from '@/utils/page';
import { getVocabularyListTitle } from '@/utils/vocabulary';

const vocabularyListSearchSchema = z.object({
  status: z.enum(LearningStatus).optional(),
  search: z.string().trim().min(1).max(255).optional(),
});

export const Route = createFileRoute('/_auth/vocabulary-lists_/$userVocabularyListId')({
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
  head: ({ loaderData }) =>
    pageHead(loaderData ? getVocabularyListTitle(loaderData.vocabularyList) : 'Vocabulary List'),
  component: VocabularyListPage,
});

function VocabularyListPage() {
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
    <EditVocabularyItemTranslationProvider userVocabularyListId={userVocabularyListId}>
      <div className="mx-auto max-w-6xl px-4 py-6">
        <div className="flex items-center justify-between gap-3">
          <h1 className="text-2xl font-bold tracking-tight md:text-3xl">
            {getVocabularyListTitle(userVocabularyList.vocabularyList)}
          </h1>
          {userVocabularyList.vocabularyList.type === VocabularyListType.Personal && (
            <AddPersonalVocabularyItemDialog userVocabularyListId={userVocabularyListId} />
          )}
        </div>

        <div className="mt-4">
          <VocabularyListProgress userVocabularyListId={userVocabularyListId} />
        </div>

        <div className="mt-6">
          <VocabularyListFilters />
        </div>

        <div className="mt-4 overflow-hidden rounded-lg border">
          {isPending ? (
            <div className="flex items-center justify-center py-8">
              <Loader />
            </div>
          ) : (
            <VocabularyItemsTable
              items={items}
              hasNextPage={hasNextPage}
              isFetchingNextPage={isFetchingNextPage}
              onLoadMore={() => void fetchNextPage({ cancelRefetch: false })}
              userVocabularyListId={userVocabularyListId}
            />
          )}
        </div>
      </div>

      <EditVocabularyItemTranslationDialog />
    </EditVocabularyItemTranslationProvider>
  );
}
