import { type FC, useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { actions } from 'astro:actions';
import {
  TaskType,
  type DefinitionToWordTask,
  type ShowcaseTask,
  type UserWord,
  type WordToDefinitionTask,
  type WriteByPronunciationTask,
} from '@/types/user-words.types';
import { ShowcaseCard } from './showcase-card';
import { DefinitionToWord } from './definition-to-word';
import { WordToDefinition } from './word-to-definition';
import { WriteByPronunciation } from './write-by-pronunciation';
import { Button } from '@/components/ui/button';
import { LearningResult } from './learning-result';
import { Loader } from './ui/loader';

const shuffle = <T,>(array: T[]): T[] => {
  return array
    .map((value) => ({ value, sort: Math.random() }))
    .sort((a, b) => a.sort - b.sort)
    .map(({ value }) => value);
};

const toShowcaseTasks = (words: UserWord[]) => {
  return words.map(
    (item): ShowcaseTask => ({
      id: crypto.randomUUID(),
      type: TaskType.Showcase,
      data: item.word,
    }),
  );
};

const toWordToDefinitionTasks = (words: UserWord[]) => {
  return words.map((target): WordToDefinitionTask => {
    const wrong = shuffle(words)
      .filter((word) => word.id !== target.id)
      .slice(0, 3)
      .map((value) => ({ id: value.id, definition: value.word.definition, isCorrect: false }));
    const correct = { id: target.id, definition: target.word.definition, isCorrect: true };
    const options = shuffle([correct, ...wrong]);

    return {
      id: crypto.randomUUID(),
      type: TaskType.WordToDefinition,
      data: {
        ...target.word,
        options,
      },
    };
  });
};

const toDefinitionToWordTasks = (words: UserWord[]) => {
  return words.map((target): DefinitionToWordTask => {
    const wrong = shuffle(words)
      .filter((word) => word.id !== target.id)
      .slice(0, 3)
      .map((value) => ({
        id: value.id,
        value: value.word.value,
        partOfSpeech: value.word.partOfSpeech,
        isCorrect: false,
      }));
    const correct = {
      id: target.id,
      value: target.word.value,
      partOfSpeech: target.word.partOfSpeech,
      isCorrect: true,
    };
    const options = shuffle([correct, ...wrong]);

    return {
      id: crypto.randomUUID(),
      type: TaskType.DefinitionToWord,
      data: {
        id: target.id,
        definition: target.word.definition,
        options,
      },
    };
  });
};

const toWriteByPronunciationTasks = (words: UserWord[]) => {
  return words.map((target): WriteByPronunciationTask => {
    return {
      id: crypto.randomUUID(),
      type: TaskType.WriteByPronunciation,
      data: {
        id: target.id,
        pronunciation: target.word.pronunciation,
        answer: target.word.value,
      },
    };
  });
};

const toLearningTasks = (words: UserWord[]) => {
  const showcaseTasks = toShowcaseTasks(words);
  const wordToDefinitionTasks = toWordToDefinitionTasks(words);
  const definitionToWordTasks = toDefinitionToWordTasks(words);
  const writeByPronunciationTasks = toWriteByPronunciationTasks(words);

  return [...showcaseTasks, ...wordToDefinitionTasks, ...definitionToWordTasks, ...writeByPronunciationTasks];
};

export const Learning: FC = () => {
  const [idx, setIdx] = useState(0);
  const [mistakes, setMistakes] = useState<Record<number, number>>({});
  const [isFinished, setIsFinished] = useState(false);

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['getLearningWords'],
    queryFn: async () => {
      return await actions.getLearningWords.orThrow({});
    },
  });

  const tasks = useMemo(() => {
    if (!data) {
      return [];
    }

    return toLearningTasks(data);
  }, [data]);

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
          <Button onClick={() => void refetch()} size="lg">
            Try Again
          </Button>
        </div>
      </div>
    );
  }

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

            {currentTask?.type === TaskType.WriteByPronunciation && (
              <WriteByPronunciation
                key={currentTask.id}
                data={currentTask.data}
                onNext={onNext}
                onMistake={onMistake}
              />
            )}
          </>
        ) : (
          <LearningResult userWords={data} mistakes={mistakes} />
        )}
      </div>
    </div>
  );
};
