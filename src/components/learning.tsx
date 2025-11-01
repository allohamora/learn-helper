import { type FC, useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { actions } from 'astro:actions';
import {
  TaskType,
  type DefinitionToWordTask,
  type TranslationToWordTask,
  type WordToTranslationTask,
  type FillTheGapTask,
  type LearningTask,
  type ShowcaseTask,
  type UserWord,
  type WordToDefinitionTask,
  type PronunciationToWordTask,
  type TranslateUkrainianSentenceTask,
  type TranslateEnglishSentenceTask,
} from '@/types/user-words.types';
import { EventType } from '@/types/event.types';
import { ShowcaseCard } from './showcase-card';
import { PronunciationToWord } from './pronunciation-to-word';
import { TranslateSentence } from './translate-sentence';
import { Button } from '@/components/ui/button';
import { LearningResult } from './learning-result';
import { Loader } from './ui/loader';
import { TextToWord } from './text-to-word';
import { WordToOptions } from './word-to-options';
import { useCreateEvents } from '@/hooks/use-create-events';

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
      .map((value) => ({ value: value.word.definition, isCorrect: false }));
    const correct = { value: target.word.definition, isCorrect: true };
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
    return {
      id: crypto.randomUUID(),
      type: TaskType.DefinitionToWord,
      data: {
        id: target.id,
        text: target.word.definition,
        word: target.word.value,
      },
    };
  });
};

const toTranslationToWordTasks = (words: UserWord[]): TranslationToWordTask[] => {
  return words.map((target): TranslationToWordTask => {
    return {
      id: crypto.randomUUID(),
      type: TaskType.TranslationToWord,
      data: {
        id: target.id,
        text: target.word.uaTranslation,
        word: target.word.value,
      },
    };
  });
};

const toWordToTranslationTasks = (words: UserWord[]): WordToTranslationTask[] => {
  return words.map((target): WordToTranslationTask => {
    const wrong = shuffle(words)
      .filter((word) => word.id !== target.id)
      .slice(0, 3)
      .map((value) => ({ value: value.word.uaTranslation, isCorrect: false }));

    const correct = { value: target.word.uaTranslation, isCorrect: true };
    const options = shuffle([correct, ...wrong]);

    return {
      id: crypto.randomUUID(),
      type: TaskType.WordToTranslation,
      data: {
        ...target.word,
        options,
      },
    };
  });
};

const toPronunciationToWordTasks = (words: UserWord[]) => {
  return words.map((target): PronunciationToWordTask => {
    return {
      id: crypto.randomUUID(),
      type: TaskType.PronunciationToWord,
      data: {
        id: target.id,
        pronunciation: target.word.pronunciation,
        word: target.word.value,
      },
    };
  });
};

const toFillTheGapTasks = (words: UserWord[], tasksData: TasksData['fillTheGapTasks']) => {
  return tasksData.map(({ id, task, answer }): FillTheGapTask => {
    const found = words.find((word) => word.id === id);
    if (!found) {
      throw new Error('Word for FillTheGap task is not found');
    }

    return {
      id: crypto.randomUUID(),
      type: TaskType.FillTheGap,
      data: {
        id,
        text: task,
        word: answer,
      },
    };
  });
};

const toTranslateUkrainianSentenceTasks = (tasksData: TasksData['translateUkrainianSentenceTasks']) => {
  return tasksData.map(({ id, sentence, options }): TranslateUkrainianSentenceTask => {
    return {
      id: crypto.randomUUID(),
      type: TaskType.TranslateUkrainianSentence,
      data: {
        id,
        sentence,
        options: shuffle(options),
      },
    };
  });
};

const toTranslateEnglishSentenceTasks = (tasksData: TasksData['translateEnglishSentenceTasks']) => {
  return tasksData.map(({ id, sentence, options }): TranslateEnglishSentenceTask => {
    return {
      id: crypto.randomUUID(),
      type: TaskType.TranslateEnglishSentence,
      data: {
        id,
        sentence,
        options: shuffle(options),
      },
    };
  });
};

const toClientTasks = (words: UserWord[]) => {
  const showcaseTasks = toShowcaseTasks(words);
  const wordToDefinitionTasks = toWordToDefinitionTasks(words);
  const definitionToWordTasks = toDefinitionToWordTasks(words);
  const wordToTranslationTasks = toWordToTranslationTasks(words);
  const translationToWordTasks = toTranslationToWordTasks(words);
  const pronunciationToWordTasks = toPronunciationToWordTasks(words);

  return [
    ...showcaseTasks,
    ...shuffle(wordToDefinitionTasks),
    ...shuffle(definitionToWordTasks),
    ...shuffle(wordToTranslationTasks),
    ...shuffle(translationToWordTasks),
    ...shuffle(pronunciationToWordTasks),
  ];
};

const toServerTasks = (words: UserWord[], tasksData: TasksData) => {
  const translateEnglishSentenceTasks = toTranslateEnglishSentenceTasks(tasksData.translateEnglishSentenceTasks);
  const translateUkrainianSentenceTasks = toTranslateUkrainianSentenceTasks(tasksData.translateUkrainianSentenceTasks);
  const fillTheGapTasks = toFillTheGapTasks(words, tasksData.fillTheGapTasks);

  return [
    ...shuffle(translateEnglishSentenceTasks),
    ...shuffle(translateUkrainianSentenceTasks),
    ...shuffle(fillTheGapTasks),
  ];
};

const getRetryId = () => `retry-${crypto.randomUUID()}`;
const isRetryId = (id: string) => id.startsWith('retry-');

export const Learning: FC = () => {
  const [idx, setIdx] = useState(0);
  const [mistakes, setMistakes] = useState<Record<number, number>>({});
  const [isFinished, setIsFinished] = useState(false);
  const [retryTasks, setRetryTasks] = useState<LearningTask[]>([]);

  const startedAt = useMemo(() => new Date(), [idx]);

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

  const { createEvent } = useCreateEvents();

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
    // type-guard
    if (!currentTask) {
      throw new Error('Current task is not found');
    }

    const nextIdx = idx + 1;
    if (nextIdx < tasks.length || getLearningTasks.isLoading) {
      createEvent({
        type: EventType.LearningTaskCompleted,
        data: {
          duration: Date.now() - startedAt.getTime(),
          taskType: currentTask.type,
          isRetry: isRetryId(currentTask.id),
        },
      });

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

    if (!currentTask) {
      throw new Error('Current task is not found');
    }

    setRetryTasks([...retryTasks, { ...currentTask, id: getRetryId() }]);

    const userWord = state[userWordId];
    if (!userWord) {
      throw new Error('User word is not found');
    }

    createEvent({
      type: EventType.LearningMistakeMade,
      userWordId,
      data: {
        taskType: currentTask.type,
      },
    });
  };

  return (
    <div className="space-y-6">
      <div>
        {!isFinished ? (
          <>
            {currentTask?.type === TaskType.Showcase && (
              <ShowcaseCard idx={idx} data={currentTask.data} onNext={onNext} onPrev={onPrev} />
            )}

            {currentTask?.type === TaskType.WordToDefinition && (
              <WordToOptions
                key={currentTask.id}
                title="What does this word mean?"
                subtitle="Select the correct definition for the given word"
                data={currentTask.data}
                onNext={onNext}
                onMistake={onMistake}
              />
            )}

            {currentTask?.type === TaskType.DefinitionToWord && (
              <TextToWord
                key={currentTask.id}
                title="Which word matches this definition?"
                subtitle="Type the correct word for the given definition"
                data={currentTask.data}
                onNext={onNext}
                onMistake={onMistake}
              />
            )}

            {currentTask?.type === TaskType.WordToTranslation && (
              <WordToOptions
                key={currentTask.id}
                title="What is the correct translation?"
                subtitle="Select the Ukrainian translation for the given word"
                data={currentTask.data}
                onNext={onNext}
                onMistake={onMistake}
              />
            )}

            {currentTask?.type === TaskType.TranslationToWord && (
              <TextToWord
                key={currentTask.id}
                title="Which word matches this translation?"
                subtitle="Type the correct word for the given translation"
                data={currentTask.data}
                onNext={onNext}
                onMistake={onMistake}
              />
            )}

            {currentTask?.type === TaskType.PronunciationToWord && (
              <PronunciationToWord key={currentTask.id} data={currentTask.data} onNext={onNext} onMistake={onMistake} />
            )}

            {currentTask?.type === TaskType.TranslateEnglishSentence && (
              <TranslateSentence
                key={currentTask.id}
                title="Select the correct translation"
                subtitle="Choose the Ukrainian translation that best matches the English sentence"
                data={currentTask.data}
                onNext={onNext}
                onMistake={onMistake}
              />
            )}

            {currentTask?.type === TaskType.TranslateUkrainianSentence && (
              <TranslateSentence
                key={currentTask.id}
                title="Select the correct translation"
                subtitle="Choose the English sentence that best matches the Ukrainian sentence"
                data={currentTask.data}
                onNext={onNext}
                onMistake={onMistake}
              />
            )}

            {currentTask?.type === TaskType.FillTheGap && (
              <TextToWord
                key={currentTask.id}
                title="Fill the gap"
                subtitle="Type the correct word for the given sentence"
                data={currentTask.data}
                onNext={onNext}
                onMistake={onMistake}
              />
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
