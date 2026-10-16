import type { ComponentProps, FC } from 'react';
import { useInfiniteQuery } from '@tanstack/react-query';
import { apiPaginationRequest, appClient, paginatedQueryOptions } from '@/services/api';
import { EditVocabularyItemTranslationDialog } from '../components/edit-vocabulary-item-translation-dialog';
import { EditVocabularyItemTranslationProvider } from '../components/edit-vocabulary-item-translation';
import { AddPersonalVocabularyItemDialog } from '../components/add-personal-vocabulary-item-dialog';
import { VocabularyListFilters } from '../components/vocabulary-list-filters';
import { VocabularyItemsTable } from '../components/vocabulary-items-table';
import { VocabularyListProgress } from '../components/vocabulary-list-progress';
import { Loader } from '@/components/ui/loader';
import { VocabularyListType, LearningStatus } from '@/const/vocabulary';
import { RequestType } from '@/const/request';
import { getVocabularyListTitle } from '../utils/vocabulary';

type Props = {
  userVocabularyListId: string;
  status?: LearningStatus;
  search?: string;
  userVocabularyList: {
    vocabularyList: {
      type: VocabularyListType;
      title: string | null;
    };
  };
  onFiltersChange: ComponentProps<typeof VocabularyListFilters>['onChange'];
};

export const VocabularyListPage: FC<Props> = ({
  userVocabularyListId,
  status,
  search,
  userVocabularyList,
  onFiltersChange,
}) => {
  const {
    data = [],
    isPending,
    isFetchingNextPage,
    hasNextPage,
    fetchNextPage,
  } = useInfiniteQuery({
    queryKey: ['vocabulary-list-items', userVocabularyListId, status, search],
    ...paginatedQueryOptions((cursor) =>
      apiPaginationRequest(
        () =>
          appClient.api.v1.users.me['vocabulary-lists'][':userVocabularyListId'].items.$get({
            param: { userVocabularyListId },
            query: { status, search, cursor, type: RequestType.All },
          }),
        'Failed to load vocabulary list items',
      ),
    ),
  });

  return (
    <EditVocabularyItemTranslationProvider userVocabularyListId={userVocabularyListId}>
      <div className="mx-auto max-w-6xl px-4 py-6">
        <div className="flex items-center justify-between gap-3">
          <h1 className="text-2xl font-bold tracking-tight md:text-3xl">
            {getVocabularyListTitle(userVocabularyList.vocabularyList)}
          </h1>
          {userVocabularyList.vocabularyList.type === VocabularyListType.Personal && (
            <AddPersonalVocabularyItemDialog />
          )}
        </div>

        <div className="mt-4">
          <VocabularyListProgress userVocabularyListId={userVocabularyListId} />
        </div>

        <div className="mt-6">
          <VocabularyListFilters status={status} search={search} onChange={onFiltersChange} />
        </div>

        <div className="mt-4 overflow-hidden rounded-lg border">
          {isPending ? (
            <div className="flex items-center justify-center py-8">
              <Loader />
            </div>
          ) : (
            <VocabularyItemsTable
              items={data}
              hasNextPage={hasNextPage}
              isFetchingNextPage={isFetchingNextPage}
              onLoadMore={() => void fetchNextPage({ cancelRefetch: false })}
              userVocabularyListId={userVocabularyListId}
              vocabularyListType={userVocabularyList.vocabularyList.type}
            />
          )}
        </div>
      </div>

      <EditVocabularyItemTranslationDialog />
    </EditVocabularyItemTranslationProvider>
  );
};
