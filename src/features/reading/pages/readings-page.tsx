import type { FC } from 'react';
import { useInfiniteQuery } from '@tanstack/react-query';
import { apiPaginationRequest, appClient, paginatedQueryOptions } from '@/services/api';
import { Button } from '@/components/ui/button';
import { Loader } from '@/components/ui/loader';
import { RequestType } from '@/const/request';
import { ReadingRow } from '../components/reading-row';
import { UploadReadingDialog } from '../components/upload-reading-dialog';

export const ReadingsPage: FC = () => {
  const {
    data = [],
    isPending,
    isError,
    isFetchingNextPage,
    hasNextPage,
    fetchNextPage,
  } = useInfiniteQuery({
    queryKey: ['readings'],
    ...paginatedQueryOptions((cursor) =>
      apiPaginationRequest(
        () =>
          appClient.api.v1.users.me.readings.$get({
            query: { cursor, type: RequestType.Data },
          }),
        'Failed to load readings',
      ),
    ),
  });

  return (
    <>
      <div className="flex flex-col items-center gap-4 px-4 pt-4 text-center md:pt-8">
        <h1 className="text-2xl font-bold tracking-tight md:text-4xl">Readings</h1>
        <UploadReadingDialog />
      </div>

      <div className="px-4 pt-6">
        {isPending ? (
          <div className="flex items-center justify-center py-8">
            <Loader />
          </div>
        ) : isError ? (
          <p className="text-center text-sm text-muted-foreground">Failed to load readings. Please try again.</p>
        ) : data.length === 0 ? (
          <p className="text-center text-sm text-muted-foreground">No readings yet.</p>
        ) : (
          <div className="mx-auto max-w-2xl space-y-4">
            <div className="divide-y overflow-hidden rounded-lg border text-left">
              {data.map((reading) => (
                <ReadingRow key={reading.id} {...reading} />
              ))}
            </div>

            {hasNextPage && (
              <div className="flex justify-center">
                <Button variant="outline" disabled={isFetchingNextPage} onClick={() => void fetchNextPage()}>
                  {isFetchingNextPage ? <Loader /> : 'Load more'}
                </Button>
              </div>
            )}
          </div>
        )}
      </div>
    </>
  );
};
