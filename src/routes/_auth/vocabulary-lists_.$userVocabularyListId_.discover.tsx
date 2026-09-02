import { useRef, useState } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { createFileRoute } from '@tanstack/react-router';
import { Undo2 } from 'lucide-react';
import { toast } from 'sonner';
import { apiRequest, apiPaginationRequest, appClient, getIsomorphicAppClient } from '@/services/api';
import { Button } from '@/components/ui/button';
import { Loader } from '@/components/ui/loader';
import { EditVocabularyItemTranslationDialog } from '@/components/edit-vocabulary-item-translation-dialog';
import { EditVocabularyItemTranslationProvider } from '@/components/providers/edit-vocabulary-item-translation';
import { VocabularyDiscoverCard } from '@/components/vocabulary-discover-card';
import { LearningStatus } from '@/const/vocabulary';
import { pageHead } from '@/utils/page';

const BATCH_LIMIT = 10;
const HISTORY_LIMIT = 5;

export const Route = createFileRoute('/_auth/vocabulary-lists_/$userVocabularyListId_/discover')({
  loader: async ({ params: { userVocabularyListId } }) => {
    const app = await getIsomorphicAppClient();

    return apiRequest(
      () =>
        app.api.v1.users.me['vocabulary-lists'][':userVocabularyListId'].$get({
          param: { userVocabularyListId },
        }),
      'Failed to load vocabulary list',
    );
  },
  head: ({ loaderData }) => pageHead(loaderData ? `Discover: ${loaderData.vocabularyList.title}` : 'Discover'),
  component: VocabularyListDiscoverPage,
});

function VocabularyListDiscoverPage() {
  const { userVocabularyListId } = Route.useParams();

  const [currentIndex, setCurrentIndex] = useState(0);
  const [handled, setHandled] = useState(0);
  const [history, setHistory] = useState<string[]>([]);
  const [startedAt, setStartedAt] = useState(new Date());

  const [isSubmitting, setIsSubmitting] = useState(false); // for disabled buttons rendering
  const isSubmittingRef = useRef(false); // for preventing double clicks

  const withSubmitGuard = async (action: () => Promise<void>) => {
    if (isSubmittingRef.current) return;
    isSubmittingRef.current = true;
    setIsSubmitting(true);

    try {
      await action();
    } finally {
      isSubmittingRef.current = false;
      setIsSubmitting(false);
    }
  };

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['vocabulary-list-discover-items', userVocabularyListId],
    queryFn: () =>
      apiPaginationRequest(
        () =>
          appClient.api.v1.users.me['vocabulary-lists'][':userVocabularyListId'].items.$get({
            param: { userVocabularyListId },
            query: { status: LearningStatus.Waiting, limit: String(BATCH_LIMIT) },
          }),
        'Failed to load waiting items',
      ),
  });

  const items = data?.data ?? [];
  const total = data?.pageInfo.total ?? 0;
  const remaining = total - handled;

  const discoverItem = useMutation({
    mutationFn: ({
      userVocabularyItemId,
      status,
      durationMs,
    }: {
      userVocabularyItemId: string;
      status: LearningStatus.Known | LearningStatus.Learning;
      durationMs: number;
    }) =>
      apiRequest(
        () =>
          appClient.api.v1.users.me['vocabulary-lists'][':userVocabularyListId'].items[
            ':userVocabularyItemId'
          ].discover.$post({
            param: { userVocabularyListId, userVocabularyItemId },
            json: { status, durationMs },
          }),
        'Failed to discover item',
      ),
  });

  const undoStatus = useMutation({
    mutationFn: ({ userVocabularyItemId }: { userVocabularyItemId: string }) =>
      apiRequest(
        () =>
          appClient.api.v1.users.me['vocabulary-lists'][':userVocabularyListId'].items[
            ':userVocabularyItemId'
          ].undo.$post({
            param: { userVocabularyListId, userVocabularyItemId },
          }),
        'Failed to undo item status',
      ),
  });

  const currentItem = items[currentIndex];

  const handle = async (status: LearningStatus.Known | LearningStatus.Learning) => {
    await withSubmitGuard(async () => {
      if (!currentItem) return;

      try {
        await discoverItem.mutateAsync({
          userVocabularyItemId: currentItem.id,
          status,
          durationMs: Date.now() - startedAt.getTime(),
        });
      } catch (error) {
        toast.error(error instanceof Error ? error.message : 'Failed to discover item');
        return;
      }

      setHistory((prev) => [currentItem.id, ...prev].slice(0, HISTORY_LIMIT));

      if (currentIndex < items.length - 1) {
        setCurrentIndex(currentIndex + 1);
        setHandled(handled + 1);
      } else {
        await refetch();
        setHandled(0);
        setCurrentIndex(0);
      }

      setStartedAt(new Date());
    });
  };

  const undo = async () => {
    await withSubmitGuard(async () => {
      const [lastUserVocabularyItemId, ...rest] = history;
      if (!lastUserVocabularyItemId) return;

      try {
        await undoStatus.mutateAsync({ userVocabularyItemId: lastUserVocabularyItemId });
      } catch (error) {
        toast.error(error instanceof Error ? error.message : 'Failed to undo item status');
        return;
      }

      setHistory(rest);
      await refetch();
      setHandled(0);
      setCurrentIndex(0);

      setStartedAt(new Date());
    });
  };

  return (
    <EditVocabularyItemTranslationProvider userVocabularyListId={userVocabularyListId}>
      {isLoading ? (
        <div className="my-4 flex items-center justify-center">
          <Loader />
        </div>
      ) : error ? (
        <div className="my-4 flex items-center justify-center">
          <div className="text-center">
            <p className="mb-4 text-destructive">{error.message}</p>
            <Button onClick={() => void refetch()}>Try Again</Button>
          </div>
        </div>
      ) : !currentItem ? (
        <div className="my-4 flex items-center justify-center">
          <div className="text-center">
            <h2 className="mb-4 text-2xl font-bold">Great job!</h2>
            <p className="mb-4 text-muted-foreground">You&apos;ve discovered all available items.</p>
          </div>
        </div>
      ) : (
        <div className="mx-auto my-4 max-w-md">
          <div className="mb-4 flex items-center justify-between text-sm md:mb-8">
            <p className="text-muted-foreground">Remaining items: {remaining}</p>
            <Button
              onClick={() => void undo()}
              variant="outline"
              size="sm"
              className="gap-2"
              disabled={history.length === 0 || isSubmitting}
            >
              <Undo2 className="size-4" />
              Undo
            </Button>
          </div>

          <VocabularyDiscoverCard item={currentItem} />

          <div className="mt-4 flex gap-3 md:mt-8 md:gap-4">
            <Button
              onClick={() => void handle(LearningStatus.Known)}
              variant="destructive"
              className="h-11 flex-1 text-base md:h-12"
              disabled={isSubmitting}
            >
              I Know This
            </Button>
            <Button
              onClick={() => void handle(LearningStatus.Learning)}
              variant="default"
              className="h-11 flex-1 text-base md:h-12"
              disabled={isSubmitting}
            >
              Learn This
            </Button>
          </div>
        </div>
      )}

      <EditVocabularyItemTranslationDialog />
    </EditVocabularyItemTranslationProvider>
  );
}
