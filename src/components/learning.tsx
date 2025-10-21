import { type FC, useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { actions } from 'astro:actions';
import {
  TaskType,
  type DefinitionToWordTask,
  type TranslationToWordTask,
  type FillTheGapTask,
  type LearningTask,
  type ShowcaseTask,
  type UserWord,
  type WordToDefinitionTask,
  type WriteByPronunciationTask,
} from '@/types/user-words.types';
import { ShowcaseCard } from './showcase-card';
import { DefinitionToWord } from './definition-to-word';
import { TranslationToWord } from './translation-to-word';
import { WordToDefinition } from './word-to-definition';
import { WriteByPronunciation } from './write-by-pronunciation';
import { Button } from '@/components/ui/button';
import { LearningResult } from './learning-result';
import { Loader } from './ui/loader';
import { track } from '@amplitude/analytics-browser';
import { FillTheGap } from './fill-the-gap';

type TasksData = Awaited<ReturnType<typeof actions.getLearningTasks.orThrow>>;

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

const toTranslationToWordTasks = (words: UserWord[]): TranslationToWordTask[] => {
  return words.map((target): TranslationToWordTask => {
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
      type: TaskType.TranslationToWord,
      data: {
        id: target.id,
        translation: target.word.uaTranslation,
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

const toFillTheGapTasks = (words: UserWord[], tasksData: TasksData['fillTheGap']) => {
  return tasksData.map(({ id, sentence }): FillTheGapTask => {
    const wrong = shuffle(words)
      .filter((word) => word.id !== id)
      .slice(0, 3)
      .map((value) => ({
        id: value.id,
        value: value.word.value,
        partOfSpeech: value.word.partOfSpeech,
        isCorrect: false,
      }));

    const found = words.find((word) => word.id === id);
    if (!found) {
      throw new Error('Word for FillTheGap task is not found');
    }

    const correct = { id, value: found.word.value, partOfSpeech: found.word.partOfSpeech, isCorrect: true };
    const options = shuffle([correct, ...wrong]);

    return {
      id: crypto.randomUUID(),
      type: TaskType.FillTheGap,
      data: {
        id,
        sentence,
        options,
      },
    };
  });
};

const toClientTasks = (words: UserWord[]) => {
  const showcaseTasks = toShowcaseTasks(words);
  const wordToDefinitionTasks = toWordToDefinitionTasks(words);
  const definitionToWordTasks = toDefinitionToWordTasks(words);
  const translationToWordTasks = toTranslationToWordTasks(words);
  const writeByPronunciationTasks = toWriteByPronunciationTasks(words);

  return [
    ...showcaseTasks,
    ...wordToDefinitionTasks,
    ...definitionToWordTasks,
    ...translationToWordTasks,
    ...writeByPronunciationTasks,
  ];
};

const toServerTasks = (words: UserWord[], tasksData: TasksData) => {
  return toFillTheGapTasks(words, tasksData.fillTheGap);
};

export const Learning: FC = () => {
  const [idx, setIdx] = useState(0);
  const [mistakes, setMistakes] = useState<Record<number, number>>({});
  const [isFinished, setIsFinished] = useState(false);
  const [retryTasks, setRetryTasks] = useState<LearningTask[]>([]);

  const startedAt = useMemo(() => new Date(), []);

  const getLearningWords = useQuery({
    queryKey: ['getLearningWords'],
    queryFn: async () => {
      return await actions.getLearningWords.orThrow({});
    },
  });

  const getLearningTasks = useQuery({
    queryKey: ['getLearningTasks'],
    queryFn: async () => {
      return await actions.getLearningTasks.orThrow({});
    },
  });

  // to preserve the same task ids between re-renders
  const clientTasks = useMemo(() => {
    if (!getLearningWords.data) {
      return [];
    }

    return toClientTasks(getLearningWords.data);
  }, [getLearningWords.data]);

  // to preserve the same task ids between re-renders
  const serverTasks = useMemo(() => {
    if (!getLearningWords.data || !getLearningTasks.data) {
      return [];
    }

    return toServerTasks(getLearningWords.data, getLearningTasks.data);
  }, [getLearningWords.data, getLearningTasks.data]);

  const tasks = [...clientTasks, ...serverTasks, ...retryTasks];

  const state = useMemo(() => {
    if (!getLearningWords.data) {
      return {};
    }

    return getLearningWords.data.reduce<Record<number, UserWord>>((state, word) => {
      state[word.id] = word;

      return state;
    }, {});
  }, [getLearningWords.data]);

  if (getLearningWords.isLoading || !getLearningWords.data) {
    return (
      <div className="flex items-center justify-center">
        <Loader />
      </div>
    );
  }

  if (getLearningWords.error || getLearningTasks.error) {
    return (
      <div className="space-y-6">
        <div className="mx-auto max-w-2xl text-center">
          <h1 className="mb-4 text-2xl font-bold">Something went wrong</h1>
          <p className="mb-6 text-muted-foreground">Failed to load learning data. Please try again.</p>
          <Button size="lg" asChild>
            <a href="/learning">Try Again</a>
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
    if (nextIdx < tasks.length || getLearningTasks.isLoading) {
      setIdx(nextIdx);
      return;
    }

    setIsFinished(true);

    const duration = Date.now() - startedAt.getTime();
    track('learning_session_complete', {
      duration,
      durationMinutes: Number((duration / 60000).toFixed(2)),
      totalTasks: tasks.length,
      totalMistakes: Object.values(mistakes).reduce((a, b) => a + b, 0),
    });
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

    if (!currentTask) {
      throw new Error('Current task is not found');
    }

    if (retryTasks.at(-1)?.id !== currentTask.id) {
      setRetryTasks([...retryTasks, currentTask]);
    }

    const userWord = state[userWordId];
    if (!userWord) {
      throw new Error('User word is not found');
    }

    track('word_learning_mistake', {
      value: userWord.word.value,
      partOfSpeech: userWord.word.partOfSpeech,
      type: currentTask?.type,
    });
  };

  return (
    <div className="space-y-6">
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

            {currentTask?.type === TaskType.TranslationToWord && (
              <TranslationToWord key={currentTask.id} data={currentTask.data} onNext={onNext} onMistake={onMistake} />
            )}

            {currentTask?.type === TaskType.FillTheGap && (
              <FillTheGap key={currentTask.id} data={currentTask.data} onNext={onNext} onMistake={onMistake} />
            )}

            {!currentTask && getLearningTasks.isLoading && (
              <div className="flex items-center justify-center">
                <Loader />
              </div>
            )}
          </>
        ) : (
          <LearningResult userWords={getLearningWords.data} mistakes={mistakes} />
        )}
      </div>
    </div>
  );
};
