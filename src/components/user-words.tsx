import { type FC, useState, useEffect } from 'react';
import { useInfiniteQuery } from '@tanstack/react-query';
import { useInView } from 'react-intersection-observer';
import { actions } from 'astro:actions';
import { UserWordsFilters } from './user-words-filters';
import { WordCard } from './word-card';
import { Loader } from './ui/loader';
import { Button } from './ui/button';
import { type Level, type List } from '@/types/user-words.types';

export const UserWords: FC = () => {
  const [level, setLevel] = useState<Level | undefined>();
  const [listType, setListType] = useState<List | undefined>();
  const { ref, inView } = useInView();

  const { data, fetchNextPage, hasNextPage, isFetchingNextPage, isLoading, isError, error, refetch } = useInfiniteQuery(
    {
      queryKey: ['userWords', level, listType],
      queryFn: async ({ pageParam }) => {
        const result = await actions.getUserWords({
          level,
          list: listType,
          cursor: pageParam,
          limit: 50,
        });

        if (result.error) {
          throw new Error(result.error.message || 'Failed to fetch user words');
        }

        return result.data;
      },
      getNextPageParam: (lastPage) => lastPage.nextCursor,
      initialPageParam: undefined as string | undefined,
    },
  );

  const allWords = data?.pages.flatMap((page) => page.data) || [];
  const totalWords = data?.pages[0]?.total || 0;
  const learningWords = data?.pages[0]?.learning || 0;

  useEffect(() => {
    if (inView && hasNextPage && !isFetchingNextPage) {
      fetchNextPage();
    }
  }, [inView, hasNextPage, isFetchingNextPage, fetchNextPage]);

  if (isError) {
    return (
      <div className="flex flex-col items-center justify-center py-12">
        <div className="text-center">
          <h3 className="mb-2 text-lg font-semibold text-red-600">Error Loading Words</h3>
          <p className="text-muted-foreground mb-4">
            {error instanceof Error ? error.message : 'Something went wrong'}
          </p>
          <Button onClick={() => refetch()} variant="outline">
            Try Again
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="mt-4 space-y-6">
      {data && (
        <div className="flex flex-col gap-6 rounded-lg p-4 sm:flex-row">
          <div className="text-center sm:text-left">
            <div className="text-foreground text-3xl font-bold">{totalWords}</div>
            <div className="text-muted-foreground text-sm">total words</div>
          </div>
          <div className="text-center sm:text-left">
            <div className="text-3xl font-bold text-green-600">
              {totalWords > 0 ? Math.round(((totalWords - learningWords) / totalWords) * 100) : 0}%
            </div>
            <div className="text-muted-foreground text-sm">progress</div>
          </div>
        </div>
      )}

      {data && (
        <UserWordsFilters level={level} listType={listType} onLevelChange={setLevel} onListTypeChange={setListType} />
      )}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
        {allWords.map((word) => (
          <WordCard key={word.id} word={word} />
        ))}

        {(isLoading || isFetchingNextPage) && (
          <div className="col-span-full flex justify-center py-8">
            <Loader className="text-muted-foreground" />
          </div>
        )}
      </div>

      {!hasNextPage && allWords.length > 0 && (
        <div className="py-8 text-center">
          <div className="text-muted-foreground">You&apos;ve reached the end! No more words to show.</div>
        </div>
      )}

      {!isLoading && allWords.length === 0 && (
        <div className="py-12 text-center">
          <div className="text-muted-foreground">
            No words found. Try adjusting your filters or add some words to get started.
          </div>
        </div>
      )}

      <div ref={ref} />
    </div>
  );
};
