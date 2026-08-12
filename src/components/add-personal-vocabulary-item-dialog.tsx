import type { FC, UIEvent } from 'react';
import { useState } from 'react';
import { useDebounce } from 'use-debounce';
import { useInfiniteQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import type { InferResponseType } from 'hono/client';
import { Check, Plus, Sparkles } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Loader } from '@/components/ui/loader';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { appClient } from '@/services/api';
import { formatPartOfSpeech } from '@/utils/vocabulary';

type SearchResponse = InferResponseType<
  (typeof appClient.api.v1.users.me)['vocabulary-lists'][':userVocabularyListId']['search']['$get']
>;
type SearchResult = Extract<SearchResponse, { success: true }>['data'][number];

const LOAD_MORE_THRESHOLD_PX = 200;

const ADDED_QUERY_KEYS = [
  'vocabulary-list-items',
  'vocabulary-list-discover-items',
  'vocabulary-list-progress',
  'vocabulary-list-learn-items',
  'vocabulary-list-learn-tasks',
];

type ResultRowProps = {
  item: SearchResult;
  userVocabularyListId: string;
};

const ResultRow: FC<ResultRowProps> = ({ item, userVocabularyListId }) => {
  const queryClient = useQueryClient();

  const addMutation = useMutation({
    mutationFn: async () => {
      const res = await appClient.api.v1.users.me['vocabulary-lists'][':userVocabularyListId'].items.$post({
        param: { userVocabularyListId },
        json: { vocabularyItemId: item.id },
      });
      if (!res.ok) throw new Error('Failed to add item');

      return res.json();
    },
    onSuccess: () => {
      ADDED_QUERY_KEYS.forEach((queryKey) => void queryClient.invalidateQueries({ queryKey: [queryKey] }));
      void queryClient.invalidateQueries({ queryKey: ['personal-vocabulary-search'] });
    },
    onError: () => toast.error('Failed to add item'),
  });

  return (
    <div className="flex items-start justify-between gap-3 px-3 py-2.5">
      <div className="min-w-0 space-y-1">
        <div className="flex flex-wrap items-baseline gap-x-2">
          <span className="font-medium">{item.value}</span>
          <span className="text-xs text-muted-foreground">({item.spelling})</span>
        </div>
        <div className="text-sm text-muted-foreground">{item.uaTranslation}</div>
        <div className="text-xs text-muted-foreground">{item.definition}</div>
        {item.partOfSpeech && (
          <Badge variant="outline" className="text-xs">
            {formatPartOfSpeech(item.partOfSpeech)}
          </Badge>
        )}
      </div>

      {item.vocabularyListItem ? (
        <Button
          size="sm"
          variant="outline"
          className="size-8 shrink-0 px-0 sm:w-auto sm:px-2.5"
          disabled
          title="Added"
          aria-label="Added"
        >
          <Check />
          <span className="hidden sm:inline">Added</span>
        </Button>
      ) : (
        <Button
          size="sm"
          className="size-8 shrink-0 px-0 sm:w-auto sm:px-2.5"
          disabled={addMutation.isPending}
          onClick={() => addMutation.mutate()}
          title={`Add ${item.value}`}
          aria-label={`Add ${item.value}`}
        >
          <Plus />
          <span className="hidden sm:inline">Add</span>
        </Button>
      )}
    </div>
  );
};

type Props = {
  userVocabularyListId: string;
};

export const AddPersonalVocabularyItemDialog: FC<Props> = ({ userVocabularyListId }) => {
  const [open, setOpen] = useState(false);
  const [searchInput, setSearchInput] = useState('');
  const [context, setContext] = useState('');
  const [debouncedValue] = useDebounce(searchInput.trim(), 300);

  const { data, isPending, isFetchingNextPage, hasNextPage, fetchNextPage } = useInfiniteQuery({
    queryKey: ['personal-vocabulary-search', userVocabularyListId, debouncedValue],
    queryFn: async ({ pageParam }) => {
      const res = await appClient.api.v1.users.me['vocabulary-lists'][':userVocabularyListId'].search.$get({
        param: { userVocabularyListId },
        query: { value: debouncedValue, cursor: pageParam },
      });
      if (!res.ok) throw new Error('Failed to search items');

      return res.json();
    },
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (lastPage) => (lastPage && 'data' in lastPage ? lastPage.pageInfo.nextCursor : undefined),
    enabled: debouncedValue.length > 0,
  });

  const results = data?.pages.flatMap((page) => ('data' in page ? page.data : [])) ?? [];

  const queryClient = useQueryClient();

  const generateMutation = useMutation({
    mutationFn: async () => {
      const res = await appClient.api.v1.users.me['vocabulary-lists'][':userVocabularyListId'].items.generate.$post({
        param: { userVocabularyListId },
        json: { value: debouncedValue, context: context.trim() || undefined },
      });
      if (!res.ok) throw new Error('Failed to generate item');

      return res.json();
    },
    onSuccess: () => {
      ADDED_QUERY_KEYS.forEach((queryKey) => void queryClient.invalidateQueries({ queryKey: [queryKey] }));
      void queryClient.invalidateQueries({ queryKey: ['personal-vocabulary-search'] });
    },
    onError: () => toast.error('Failed to generate item'),
  });

  const handleScroll = (event: UIEvent<HTMLDivElement>) => {
    if (!hasNextPage || isFetchingNextPage) return;

    const { scrollTop, scrollHeight, clientHeight } = event.currentTarget;
    const distanceFromBottom = scrollHeight - scrollTop - clientHeight;

    if (distanceFromBottom < LOAD_MORE_THRESHOLD_PX) {
      void fetchNextPage();
    }
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(nextOpen) => {
        setOpen(nextOpen);
        if (!nextOpen) {
          setSearchInput('');
          setContext('');
        }
      }}
    >
      <DialogTrigger asChild>
        <Button size="sm" className="size-8 px-0 sm:w-auto sm:px-2.5" title="Add item" aria-label="Add item">
          <Plus />
          <span className="hidden sm:inline">Add</span>
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add item</DialogTitle>
        </DialogHeader>

        <Input
          placeholder="Search items..."
          value={searchInput}
          onChange={(e) => setSearchInput(e.target.value)}
          autoFocus
        />

        <div className="flex items-center gap-2">
          <Input
            placeholder="Context for AI generation"
            value={context}
            onChange={(e) => setContext(e.target.value)}
            className="flex-1"
          />
          <Button
            size="icon"
            variant="outline"
            disabled={debouncedValue.length === 0 || generateMutation.isPending}
            onClick={() => generateMutation.mutate()}
            title={`Generate "${debouncedValue}" with AI & add`}
            aria-label={`Generate "${debouncedValue}" with AI & add`}
          >
            <Sparkles />
          </Button>
        </div>

        <div className="h-[60vh] overflow-y-auto rounded-lg border" onScroll={handleScroll}>
          {debouncedValue.length === 0 ? (
            <p className="px-3 py-6 text-center text-sm text-muted-foreground">Start typing to search items.</p>
          ) : isPending ? (
            <div className="flex items-center justify-center py-6">
              <Loader />
            </div>
          ) : results.length === 0 ? (
            <p className="px-3 py-6 text-center text-sm text-muted-foreground">
              No matches for &ldquo;{debouncedValue}&rdquo;.
            </p>
          ) : (
            <div className="divide-y">
              {results.map((item) => (
                <ResultRow key={item.id} item={item} userVocabularyListId={userVocabularyListId} />
              ))}
              {isFetchingNextPage && (
                <div className="flex items-center justify-center py-3">
                  <Loader />
                </div>
              )}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};
