import { useState } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { actions } from 'astro:actions';
import { Button } from '@/components/ui/button';
import { WordDiscoveryCard } from '@/components/word-discovery-card';
import { Status } from '@/types/user-words.types';

type DiscoveryStatus = typeof Status.Learning | typeof Status.Known;

export function Discovery() {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [handled, setHandled] = useState(0);

  const {
    data: wordsData,
    isLoading,
    error,
    refetch,
  } = useQuery({
    queryKey: ['waitingWords'],
    queryFn: async () => {
      const result = await actions.getWaitingWords({ limit: 10 });
      if (result.error) {
        throw new Error('Failed to load words');
      }
      return result.data;
    },
  });

  const words = wordsData?.data || [];
  const total = wordsData?.total || 0;
  const remaining = total - handled;

  const updateWordMutation = useMutation({
    mutationFn: async ({ userWordId, status }: { userWordId: number; status: DiscoveryStatus }) => {
      const result = await actions.updateWordStatus({ userWordId, status });
      if (result.error) {
        throw new Error('Failed to update word status');
      }

      return result.data;
    },
  });

  const handle = async (status: DiscoveryStatus) => {
    const currentWord = words[currentIndex];
    if (!currentWord) return;

    await updateWordMutation.mutateAsync({
      userWordId: currentWord.id,
      status,
    });

    if (currentIndex < words.length - 1) {
      setCurrentIndex(currentIndex + 1);
      setHandled(handled + 1);
    } else {
      await refetch();
      setHandled(0);
      setCurrentIndex(0);
    }
  };

  const currentWord = words[currentIndex];

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="text-center">
          <div className="border-primary mx-auto mb-4 h-8 w-8 animate-spin rounded-full border-b-2"></div>
          <p className="text-muted-foreground">Loading words...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="text-center">
          <p className="text-destructive mb-4">{error.message}</p>
          <Button onClick={() => refetch()}>Try Again</Button>
        </div>
      </div>
    );
  }

  if (!currentWord) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="text-center">
          <h2 className="mb-4 text-2xl font-bold">Great job!</h2>
          <p className="text-muted-foreground mb-4">You&apos;ve reviewed all available words.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-background min-h-screen p-4">
      <div className="mx-auto max-w-md pt-8">
        <div className="mb-8 text-center">
          <p className="text-muted-foreground text-sm">Remaining words: {remaining}</p>
        </div>

        <WordDiscoveryCard word={currentWord} />

        <div className="mt-8 flex gap-4">
          <Button
            onClick={async () => await handle(Status.Known)}
            variant="destructive"
            className="h-12 flex-1 text-base"
            disabled={updateWordMutation.isPending}
          >
            I Know This
          </Button>
          <Button
            onClick={async () => await handle(Status.Learning)}
            variant="default"
            className="h-12 flex-1 text-base"
            disabled={updateWordMutation.isPending}
          >
            Learn This
          </Button>
        </div>
      </div>
    </div>
  );
}
