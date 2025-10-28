import { type FC, useState } from 'react';
import { useInfiniteQuery } from '@tanstack/react-query';
import { actions } from 'astro:actions';
import { UserWordsFilters } from './user-words-filters';
import { WordsTable } from './words-table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from './ui/tabs';
import { Button } from './ui/button';
import { Level, Status, List } from '@/types/user-words.types';

export const UserWords: FC = () => {
  const [level, setLevel] = useState<Level | undefined>();
  const [status, setStatus] = useState<Status | undefined>();
  const [list, setList] = useState<List>(List.Oxford5000Words);

  const { data, fetchNextPage, hasNextPage, isFetchingNextPage, isLoading, isError, error, refetch } = useInfiniteQuery(
    {
      queryKey: ['getUserWords', level, status, list],
      queryFn: async ({ pageParam }) => {
        return await actions.getUserWords.orThrow({
          level,
          status,
          list,
          cursor: pageParam,
          limit: 50,
        });
      },
      getNextPageParam: (lastPage) => lastPage.nextCursor,
      initialPageParam: undefined as string | undefined,
    },
  );

  const allWords = data?.pages.flatMap((page) => page.data) || [];
  const totalWords = data?.pages[0]?.total || 0;
  const learningWords = data?.pages[0]?.learning || 0;

  const handleTabChange = (value: string) => {
    setList(value as List);
    setLevel(undefined);
    setStatus(undefined);
  };

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center py-12">
        <div className="text-center">
          <h3 className="mb-2 text-lg font-semibold text-foreground">Loading Words...</h3>
          <p className="text-muted-foreground">Please wait while we fetch your words.</p>
        </div>
      </div>
    );
  }

  if (isError) {
    return (
      <div className="flex flex-col items-center justify-center py-12">
        <div className="text-center">
          <h3 className="mb-2 text-lg font-semibold text-red-600">Error Loading Words</h3>
          <p className="mb-4 text-muted-foreground">
            {error instanceof Error ? error.message : 'Something went wrong'}
          </p>
          <Button onClick={() => void refetch()} variant="outline">
            Try Again
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4 md:space-y-6">
      {data && (
        <div className="flex flex-row justify-center gap-4 rounded-lg sm:gap-6 md:justify-start md:p-4">
          <div className="text-center sm:text-left">
            <div className="text-2xl font-bold text-foreground md:text-3xl">{totalWords}</div>
            <div className="text-xs text-muted-foreground md:text-sm">total words</div>
          </div>
          {!status && (
            <div className="text-center sm:text-left">
              <div className="text-2xl font-bold text-green-600 md:text-3xl">
                {totalWords > 0 ? Math.round(((totalWords - learningWords) / totalWords) * 100) : 0}%
              </div>
              <div className="text-xs text-muted-foreground md:text-sm">progress</div>
            </div>
          )}
        </div>
      )}

      <Tabs value={list} onValueChange={handleTabChange}>
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <TabsList className="grid w-full grid-cols-2 sm:w-auto">
            <TabsTrigger value={List.Oxford5000Words}>Oxford 5000</TabsTrigger>
            <TabsTrigger value={List.OxfordPhraseList}>Phrase List</TabsTrigger>
          </TabsList>

          {data && (
            <UserWordsFilters level={level} status={status} onLevelChange={setLevel} onStatusChange={setStatus} />
          )}
        </div>

        <TabsContent value={List.Oxford5000Words} className="mt-4 md:mt-6">
          <WordsTable
            data={allWords}
            isLoading={isLoading}
            isFetchingNextPage={isFetchingNextPage}
            hasNextPage={hasNextPage}
            onLoadMore={fetchNextPage}
            showPartOfSpeech={true}
          />
        </TabsContent>

        <TabsContent value={List.OxfordPhraseList} className="mt-4 md:mt-6">
          <WordsTable
            data={allWords}
            isLoading={isLoading}
            isFetchingNextPage={isFetchingNextPage}
            hasNextPage={hasNextPage}
            onLoadMore={fetchNextPage}
            showPartOfSpeech={false}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
};
