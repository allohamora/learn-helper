import { useState } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { actions } from 'astro:actions';
import { Button } from '@/components/ui/button';
import { WordDiscoveryCard } from '@/components/word-discovery-card';
import { Status } from '@/types/user-words.types';
import { Loader } from './ui/loader';
import { track } from '@amplitude/analytics-browser';
import { Undo2 } from 'lucide-react';

const HISTORY_LIMIT = 5;

type DiscoveryStatus = typeof Status.Learning | typeof Status.Known | typeof Status.Waiting;

export function Discovery() {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [handled, setHandled] = useState(0);
  const [history, setHistory] = useState<number[]>([]);

  const {
    data: wordsData,
    isLoading,
    error,
    refetch,
  } = useQuery({
    queryKey: ['getWaitingWords'],
    queryFn: async () => {
      const res = await actions.getWaitingWords.orThrow({});

      setHandled(0);
      setCurrentIndex(0);

      return res;
    },
  });

  const words = wordsData?.data || [];
  const total = wordsData?.total || 0;
  const remaining = total - handled;

  const updateUserWordStatus = useMutation({
    mutationFn: async (data: { userWordId: number; status: DiscoveryStatus }) => {
      track('word_status_update', data);

      return await actions.updateUserWordStatus(data);
    },
  });

  const handle = async (status: DiscoveryStatus) => {
    const currentWord = words[currentIndex];
    if (!currentWord) return;

    await updateUserWordStatus.mutateAsync({
      userWordId: currentWord.id,
      status,
    });

    if (currentIndex < words.length - 1) {
      setCurrentIndex(currentIndex + 1);
      setHandled(handled + 1);
      setHistory((prev) => [currentWord.id, ...prev].slice(0, HISTORY_LIMIT));
    } else {
      await refetch();
    }
  };

  const undo = async () => {
    const [lastUserWordId, ...rest] = history;
    if (!lastUserWordId) return;

    await updateUserWordStatus.mutateAsync({
      userWordId: lastUserWordId,
      status: Status.Waiting,
    });

    setHistory(rest);
    setHandled((prev) => (prev > 0 ? prev - 1 : 0));
    setCurrentIndex((prev) => (prev > 0 ? prev - 1 : 0));
    await refetch();
  };

  const currentWord = words[currentIndex];

  if (isLoading) {
    return (
      <div className="flex items-center justify-center">
        <Loader />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center">
        <div className="text-center">
          <p className="mb-4 text-destructive">{error.message}</p>
          <Button onClick={() => void refetch()}>Try Again</Button>
        </div>
      </div>
    );
  }

  if (!currentWord) {
    return (
      <div className="flex items-center justify-center">
        <div className="text-center">
          <h2 className="mb-4 text-2xl font-bold">Great job!</h2>
          <p className="mb-4 text-muted-foreground">You&apos;ve reviewed all available words.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="mx-auto max-w-md pt-8">
        <div className="mb-8 flex items-center justify-between text-sm">
          <p className="text-muted-foreground">Remaining words: {remaining}</p>
          <Button
            onClick={() => void undo()}
            variant="outline"
            size="sm"
            className="gap-2"
            disabled={history.length === 0 || updateUserWordStatus.isPending}
          >
            <Undo2 className="h-4 w-4" />
            Undo
          </Button>
        </div>

        <WordDiscoveryCard userWord={currentWord} />

        <div className="mt-8 flex gap-4">
          <Button
            onClick={() => void handle(Status.Known)}
            variant="destructive"
            className="h-12 flex-1 text-base"
            disabled={updateUserWordStatus.isPending}
          >
            I Know This
          </Button>
          <Button
            onClick={() => void handle(Status.Learning)}
            variant="default"
            className="h-12 flex-1 text-base"
            disabled={updateUserWordStatus.isPending}
          >
            Learn This
          </Button>
        </div>
      </div>
    </div>
  );
}
