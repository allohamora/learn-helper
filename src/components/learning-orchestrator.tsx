import { type FC, useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { actions } from 'astro:actions';
import { Status } from '@/types/user-words.types';
import { ShowcaseCard } from './showcase-card';
import { DefinitionToWord } from './definition-to-word';
import { WordToDefinition } from './word-to-definition';
import { Loader } from '@/components/ui/loader';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

type LearningPhase = 'loading' | 'showcase' | 'definition-to-word' | 'word-to-definition' | 'completed';

type TaskResult = {
  wordId: number;
  userWordId: number;
  failures: number;
};

export const LearningOrchestrator: FC = () => {
  const [phase, setPhase] = useState<LearningPhase>('loading');
  const [currentTaskWordIndex, setCurrentTaskWordIndex] = useState(0);
  const [showcaseWordIndex, setShowcaseWordIndex] = useState(0);
  const [taskResults, setTaskResults] = useState<Map<string, TaskResult>>(new Map());
  const queryClient = useQueryClient();

  // React Query for loading learning words
  const {
    data: wordsData,
    isLoading,
    error,
    isSuccess,
  } = useQuery({
    queryKey: ['learningWords'],
    queryFn: async () => {
      const result = await actions.getLearningWords({});
      if (result.error) {
        throw new Error('Failed to load learning words');
      }
      return result.data;
    },
  });

  // React Query mutation for updating word status
  const updateWordStatusMutation = useMutation({
    mutationFn: async ({ userWordId, status }: { userWordId: number; status: Status }) => {
      const result = await actions.updateWordStatus({ userWordId, status });
      if (result.error) {
        throw new Error('Failed to update word status');
      }
      return result.data;
    },
    onSuccess: () => {
      // Invalidate and refetch learning words query
      queryClient.invalidateQueries({ queryKey: ['learningWords'] });
      // Also invalidate user words if it exists
      queryClient.invalidateQueries({ queryKey: ['userWords'] });
      queryClient.invalidateQueries({ queryKey: ['waitingWords'] });
    },
    onError: (error) => {
      console.error('Failed to update word status:', error);
    },
  });

  const words = wordsData?.words || [];

  // Update phase based on query results
  useEffect(() => {
    if (isLoading) {
      setPhase('loading');
    } else if (isSuccess) {
      if (words.length > 0) {
        setPhase('showcase');
      } else {
        setPhase('completed');
      }
    } else if (error) {
      console.error('Failed to load learning words:', error);
      setPhase('completed');
    }
  }, [isLoading, isSuccess, error, words.length]);

  const currentTaskWord = words[currentTaskWordIndex];
  const showcaseWord = words[showcaseWordIndex];

  const handleShowcaseNext = () => {
    if (showcaseWordIndex < words.length - 1) {
      setShowcaseWordIndex((prev) => prev + 1);
    }
  };

  const handleShowcasePrev = () => {
    if (showcaseWordIndex > 0) {
      setShowcaseWordIndex((prev) => prev - 1);
    }
  };

  const handleShowcaseComplete = () => {
    setCurrentTaskWordIndex(0);
    setPhase('definition-to-word');
  };

  const handleDefinitionToWordComplete = (failures: number) => {
    const key = `${currentTaskWord.id}-definition-to-word`;
    setTaskResults(
      (prev) =>
        new Map(
          prev.set(key, {
            wordId: currentTaskWord.id,
            userWordId: currentTaskWord.id,
            failures,
          }),
        ),
    );

    // Move to next word for definition-to-word phase
    if (currentTaskWordIndex < words.length - 1) {
      setCurrentTaskWordIndex((prev) => prev + 1);
    } else {
      // All definition-to-word tasks complete, start word-to-definition phase
      setCurrentTaskWordIndex(0);
      setPhase('word-to-definition');
    }
  };

  const handleWordToDefinitionComplete = (failures: number) => {
    const key = `${currentTaskWord.id}-word-to-definition`;
    setTaskResults(
      (prev) =>
        new Map(
          prev.set(key, {
            wordId: currentTaskWord.id,
            userWordId: currentTaskWord.id,
            failures,
          }),
        ),
    );

    // Move to next word for word-to-definition phase
    if (currentTaskWordIndex < words.length - 1) {
      setCurrentTaskWordIndex((prev) => prev + 1);
    } else {
      // All tasks complete
      setPhase('completed');
      // Update statuses in the background
      updateWordStatuses();
    }
  };

  const updateWordStatuses = async () => {
    try {
      // Calculate total failures for each word and update status
      const statusUpdates = words.map((word) => {
        const defToWordKey = `${word.id}-definition-to-word`;
        const wordToDefKey = `${word.id}-word-to-definition`;

        const defToWordFailures = taskResults.get(defToWordKey)?.failures || 0;
        const wordToDefFailures = taskResults.get(wordToDefKey)?.failures || 0;
        const totalFailures = defToWordFailures + wordToDefFailures;

        // If total failures >= 4: Struggling, else: Reviewing
        const newStatus = totalFailures >= 4 ? Status.Struggling : Status.Reviewing;

        return updateWordStatusMutation.mutateAsync({
          userWordId: word.id,
          status: newStatus,
        });
      });

      // Wait for all status updates to complete
      await Promise.all(statusUpdates);
    } catch (error) {
      console.error('Failed to update word statuses:', error);
    }
  };

  if (phase === 'loading') {
    return (
      <div className="mt-4 flex items-center justify-center">
        <div className="text-center">
          <div className="border-primary mx-auto mb-4 h-8 w-8 animate-spin rounded-full border-b-2"></div>
          <p className="text-muted-foreground">Loading learning words...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="mt-4 space-y-6">
        <div className="mx-auto max-w-2xl text-center">
          <h1 className="mb-4 text-2xl font-bold">Something went wrong</h1>
          <p className="text-muted-foreground mb-6">Failed to load learning words. Please try again.</p>
          <Button onClick={() => queryClient.invalidateQueries({ queryKey: ['learningWords'] })} size="lg">
            Try Again
          </Button>
        </div>
      </div>
    );
  }

  if (phase === 'completed') {
    return (
      <div className="mt-4 space-y-6">
        <div className="mx-auto max-w-2xl text-center">
          <h1 className="mb-4 text-3xl font-bold">Learning Session Complete! 🎉</h1>

          {updateWordStatusMutation.isPending && (
            <div className="mb-4 flex items-center justify-center">
              <Loader className="mr-2 h-6 w-6" />
              <span className="text-muted-foreground">Updating word progress...</span>
            </div>
          )}

          {words.length === 0 ? (
            <>
              <p className="text-muted-foreground mb-6 text-lg">
                No words to learn right now. Try discovering some new words!
              </p>
              <div className="space-y-3">
                <Button asChild size="lg">
                  <a href="/discovery">Discover New Words</a>
                </Button>
                <br />
                <Button variant="outline" asChild>
                  <a href="/">Back to Dashboard</a>
                </Button>
              </div>
            </>
          ) : (
            <>
              <p className="text-muted-foreground mb-6 text-lg">
                You&apos;ve completed learning {words.length} word{words.length > 1 ? 's' : ''}.
              </p>

              {/* Show summary of results */}
              <div className="bg-muted/50 mb-6 rounded-lg p-6">
                <h3 className="mb-4 font-semibold">Session Summary</h3>
                <div className="space-y-2">
                  {words.map((word) => {
                    const defToWordKey = `${word.id}-definition-to-word`;
                    const wordToDefKey = `${word.id}-word-to-definition`;
                    const defToWordFailures = taskResults.get(defToWordKey)?.failures || 0;
                    const wordToDefFailures = taskResults.get(wordToDefKey)?.failures || 0;
                    const totalFailures = defToWordFailures + wordToDefFailures;
                    const status = totalFailures >= 4 ? 'Needs more practice' : 'Ready for review';

                    return (
                      <div key={word.id} className="flex items-center justify-between">
                        <span className="font-medium">{word.value}</span>
                        <span
                          className={cn('text-sm', {
                            'text-orange-600': totalFailures >= 4,
                            'text-green-600': totalFailures < 4,
                          })}
                        >
                          {status} ({totalFailures} errors)
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>

              <div className="space-y-3">
                <Button
                  onClick={() => {
                    // Reset state and refetch learning words
                    setPhase('loading');
                    setCurrentTaskWordIndex(0);
                    setShowcaseWordIndex(0);
                    setTaskResults(new Map());
                    queryClient.invalidateQueries({ queryKey: ['learningWords'] });
                  }}
                  size="lg"
                  disabled={updateWordStatusMutation.isPending}
                >
                  {updateWordStatusMutation.isPending ? 'Saving...' : 'Learn More Words'}
                </Button>
                <br />
                <Button variant="outline" asChild>
                  <a href="/words">View All Words</a>
                </Button>
                <br />
                <Button variant="outline" asChild>
                  <a href="/">Back to Dashboard</a>
                </Button>
              </div>
            </>
          )}
        </div>
      </div>
    );
  }

  if (!currentTaskWord && phase !== 'showcase') return null;

  return (
    <div className="mt-4 space-y-6">
      <div className="mb-6">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold">Learning Session</h1>
          <span className="text-muted-foreground">
            {phase === 'showcase'
              ? `Preview: ${showcaseWordIndex + 1} of ${words.length}`
              : phase === 'definition-to-word'
                ? `Definition → Word: ${currentTaskWordIndex + 1} of ${words.length}`
                : `Word → Definition: ${currentTaskWordIndex + 1} of ${words.length}`}
          </span>
        </div>
        <div className="bg-muted mt-2 h-2 w-full rounded-full">
          <div
            className="bg-primary h-2 rounded-full transition-all duration-300"
            style={{
              width: `${(() => {
                if (phase === 'showcase') {
                  return 0; // Showcase is preparation, doesn't count toward progress
                }
                if (phase === 'definition-to-word') {
                  // First half: definition-to-word tasks (0% to 50%)
                  return ((currentTaskWordIndex + 1) / words.length) * 50;
                }
                if (phase === 'word-to-definition') {
                  // Second half: word-to-definition tasks (50% to 100%)
                  return 50 + ((currentTaskWordIndex + 1) / words.length) * 50;
                }
                return 100; // Completed
              })()}%`,
            }}
          />
        </div>
      </div>

      <div className="min-h-[600px]">
        {phase === 'showcase' && showcaseWord && (
          <ShowcaseCard
            word={showcaseWord}
            onNext={handleShowcaseNext}
            onPrev={handleShowcasePrev}
            onComplete={handleShowcaseComplete}
            currentIndex={showcaseWordIndex}
            totalWords={words.length}
            isLastWord={showcaseWordIndex === words.length - 1}
          />
        )}

        {phase === 'definition-to-word' && currentTaskWord && (
          <DefinitionToWord
            word={currentTaskWord}
            otherWords={words.filter((w) => w.id !== currentTaskWord.id)}
            onComplete={handleDefinitionToWordComplete}
          />
        )}

        {phase === 'word-to-definition' && currentTaskWord && (
          <WordToDefinition
            word={currentTaskWord}
            otherWords={words.filter((w) => w.id !== currentTaskWord.id)}
            onComplete={handleWordToDefinitionComplete}
          />
        )}
      </div>
    </div>
  );
};
