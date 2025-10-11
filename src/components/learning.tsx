import { type FC, useState } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { actions } from 'astro:actions';
import { Status, TaskType } from '@/types/user-words.types';
import { ShowcaseCard } from './showcase-card';
import { DefinitionToWord } from './definition-to-word';
import { WordToDefinition } from './word-to-definition';
import { Button } from '@/components/ui/button';
import { LearningResult } from './learning-result';
import { Loader } from './ui/loader';

const MISTAKES_THRESHOLD = 2;

export const Learning: FC = () => {
  const [idx, setIdx] = useState(0);
  const [mistakes, setMistakes] = useState<Record<number, number>>({});
  const [isFinished, setIsFinished] = useState(false);

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['getLearningTasks'],
    queryFn: async () => {
      const result = await actions.getLearningTasks({});
      if (result.error) {
        throw new Error('Failed to load learning tasks');
      }

      return result.data;
    },
  });

  const updateUserWordStatuses = useMutation({
    mutationFn: async (data: { userWordId: number; status: Status }[]) => {
      const result = await actions.updateUserWordStatuses({ data });
      if (result.error) {
        throw new Error('Failed to update word statuses');
      }

      return result.data;
    },
  });

  if (isLoading || !data) {
    return (
      <div className="flex items-center justify-center">
        <Loader />
      </div>
    );
  }

  if (error) {
    return (
      <div className="space-y-6">
        <div className="mx-auto max-w-2xl text-center">
          <h1 className="mb-4 text-2xl font-bold">Something went wrong</h1>
          <p className="mb-6 text-muted-foreground">Failed to load learning words. Please try again.</p>
          <Button onClick={() => refetch()} size="lg">
            Try Again
          </Button>
        </div>
      </div>
    );
  }

  const { showcaseTasks, wordToDefinitionTasks, definitionToWordTasks } = data;
  const tasks = [...showcaseTasks, ...wordToDefinitionTasks, ...definitionToWordTasks];

  if (!tasks || tasks.length === 0) {
    return (
      <div className="space-y-6">
        <div className="mx-auto max-w-2xl text-center">
          <h1 className="mb-4 text-2xl font-bold">No Words to Learn</h1>
          <p className="mb-6 text-lg text-muted-foreground">You have no words to learn at the moment.</p>
        </div>
      </div>
    );
  }

  const currentTask = tasks[idx];

  const onNext = () => {
    const nextIdx = idx + 1;
    if (nextIdx < tasks.length) {
      setIdx(nextIdx);
      return;
    }

    setIsFinished(true);

    const data = showcaseTasks.map((task) => ({
      userWordId: task.data.id,
      status: (mistakes[task.data.id] || 0) >= MISTAKES_THRESHOLD ? Status.Struggling : Status.Reviewing,
    }));

    updateUserWordStatuses.mutate(data);
  };

  const onPrev = () => {
    const nextIdx = idx - 1;
    if (nextIdx < 0) {
      console.warn('Already at the first task');
      return;
    }

    setIdx(nextIdx);
  };

  const onMistake = (userWordId: number) => {
    setMistakes({ ...mistakes, [userWordId]: (mistakes[userWordId] || 0) + 1 });
  };

  return (
    <div className="space-y-6">
      <div className="mb-6">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold">Learning Session</h1>
          <span className="text-muted-foreground">
            {idx + 1} of {tasks.length}
          </span>
        </div>
        <div className="mt-2 h-2 w-full rounded-full bg-muted">
          <div
            className="h-2 rounded-full bg-primary transition-all duration-300"
            style={{
              width: `${((idx + 1) / tasks.length) * 100}%`,
            }}
          />
        </div>
      </div>

      <div className="min-h-[600px]">
        {!isFinished ? (
          <>
            {currentTask?.type === TaskType.Showcase && (
              <ShowcaseCard idx={idx} data={currentTask.data} onNext={onNext} onPrev={onPrev} />
            )}

            {currentTask?.type === TaskType.DefinitionToWord && (
              <DefinitionToWord key={currentTask.id} data={currentTask.data} onNext={onNext} onMistake={onMistake} />
            )}

            {currentTask?.type === TaskType.WordToDefinition && (
              <WordToDefinition key={currentTask.id} data={currentTask.data} onNext={onNext} onMistake={onMistake} />
            )}
          </>
        ) : (
          <LearningResult
            showcaseTasks={showcaseTasks}
            mistakes={mistakes}
            isPending={updateUserWordStatuses.isPending}
          />
        )}
      </div>
    </div>
  );
};
