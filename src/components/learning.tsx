import { type FC, useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { actions } from 'astro:actions';
import {
  TaskType,
  type DefinitionToWordTask,
  type TranslationToWordTask,
  type WordToTranslationTask,
  type FillInTheGapTask,
  type LearningTask,
  type ShowcaseTask,
  type UserWord,
  type WordToDefinitionTask,
  type PronunciationToWordTask,
  type TranslateUkrainianSentenceTask,
  type TranslateEnglishSentenceTask,
  type SynonymAndAntonymTask,
  type FindIncorrectSentenceTask,
  type UsageDescriptionToWordTask,
  type WordOrderTask,
} from '@/types/user-words.types';
import { EventType } from '@/types/event.types';
import { ShowcaseCard } from './showcase-card';
import { PronunciationToWord } from './pronunciation-to-word';
import { SentenceToOptions } from './sentence-to-options';
import { Button } from '@/components/ui/button';
import { LearningResult } from './learning-result';
import { Loader } from './ui/loader';
import { TextToWord } from './text-to-word';
import { WordToOptions } from './word-to-options';
import { SynonymAndAntonymToWord } from './synonym-and-antonym-to-word';
import { WordOrder } from './word-order';
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
    const alternatives = shuffle(words)
      .filter((word) => word.id !== target.id)
      .slice(0, 3)
      .map((value) => ({ value: value.word.definition, isAnswer: false }));
    const answer = { value: target.word.definition, isAnswer: true };
    const options = shuffle([answer, ...alternatives]);

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
    const alternatives = shuffle(words)
      .filter((word) => word.id !== target.id)
      .slice(0, 3)
      .map((value) => ({ value: value.word.uaTranslation, isAnswer: false }));

    const answer = { value: target.word.uaTranslation, isAnswer: true };
    const options = shuffle([answer, ...alternatives]);

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

const toFillInTheGapTasks = (words: UserWord[], tasksData: TasksData['fillInTheGapTasks']) => {
  return tasksData.map(({ id, task, answer }): FillInTheGapTask => {
    const found = words.find((word) => word.id === id);
    if (!found) {
      throw new Error('Word for FillInTheGap task is not found');
    }

    return {
      id: crypto.randomUUID(),
      type: TaskType.FillInTheGap,
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

const toSynonymAndAntonymTasks = (words: UserWord[], tasksData: TasksData['synonymAndAntonymTasks']) => {
  return tasksData.map(({ id, synonym, antonym }): SynonymAndAntonymTask => {
    const found = words.find((word) => word.id === id);
    if (!found) {
      throw new Error('Word for SynonymAndAntonym task is not found');
    }

    return {
      id: crypto.randomUUID(),
      type: TaskType.SynonymAndAntonym,
      data: {
        id,
        word: found.word.value,
        synonym,
        antonym,
      },
    };
  });
};

const toFindIncorrectSentenceTasks = (words: UserWord[], tasksData: TasksData['findIncorrectSentenceTasks']) => {
  return tasksData.map(({ id, options }): FindIncorrectSentenceTask => {
    const found = words.find((word) => word.id === id);
    if (!found) {
      throw new Error('Word for FindIncorrectSentence task is not found');
    }

    return {
      id: crypto.randomUUID(),
      type: TaskType.FindIncorrectSentence,
      data: {
        ...found.word,
        id,
        options: shuffle(options),
      },
    };
  });
};

const toUsageDescriptionToWordTasks = (words: UserWord[], tasksData: TasksData['usageDescriptionToWordTasks']) => {
  return tasksData.map(({ id, description }): UsageDescriptionToWordTask => {
    const found = words.find((word) => word.id === id);
    if (!found) {
      throw new Error('Word for UsageDescriptionToWord task is not found');
    }

    return {
      id: crypto.randomUUID(),
      type: TaskType.UsageDescriptionToWord,
      data: {
        id,
        text: description,
        word: found.word.value,
      },
    };
  });
};

const toWordOrderTasks = (words: UserWord[], tasksData: TasksData['wordOrderTasks']) => {
  return tasksData.map(({ id, sentence }): WordOrderTask => {
    const found = words.find((word) => word.id === id);
    if (!found) {
      throw new Error('Word for WordOrder task is not found');
    }

    const sentenceWords = sentence
      .split(' ')
      .filter((word) => !!word.trim())
      .map((value, idx) => ({ idx, value }));

    return {
      id: crypto.randomUUID(),
      type: TaskType.WordOrder,
      data: {
        id,
        words: shuffle([...sentenceWords]),
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
  const fillInTheGapTasks = toFillInTheGapTasks(words, tasksData.fillInTheGapTasks);
  const synonymAndAntonymTasks = toSynonymAndAntonymTasks(words, tasksData.synonymAndAntonymTasks);
  const findIncorrectSentenceTasks = toFindIncorrectSentenceTasks(words, tasksData.findIncorrectSentenceTasks);
  const usageDescriptionToWordTasks = toUsageDescriptionToWordTasks(words, tasksData.usageDescriptionToWordTasks);
  const wordOrderTasks = toWordOrderTasks(words, tasksData.wordOrderTasks);

  return [
    ...shuffle(translateEnglishSentenceTasks),
    ...shuffle(translateUkrainianSentenceTasks),
    ...shuffle(fillInTheGapTasks),
    ...shuffle(synonymAndAntonymTasks),
    ...shuffle(findIncorrectSentenceTasks),
    ...shuffle(usageDescriptionToWordTasks),
    ...shuffle(wordOrderTasks),
  ];
};

const getRetryId = () => `retry-${crypto.randomUUID()}`;
const isRetryId = (id: string) => id.startsWith('retry-');

export const Learning: FC = () => {
  const [idx, setIdx] = useState(0);
  const [mistakes, setMistakes] = useState<Record<number, number>>({});
  const [isFinished, setIsFinished] = useState(false);
  const [retryTasks, setRetryTasks] = useState<(LearningTask & { originalTaskId: string })[]>([]);
  const [startedAt, setStartedAt] = useState(new Date());

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

  const createTaskCompletedEvent = () => {
    // type-guard
    if (!currentTask) {
      throw new Error('Current task is not found');
    }

    const durationMs = Date.now() - startedAt.getTime();
    if (currentTask.type !== TaskType.Showcase) {
      createEvent({
        type: isRetryId(currentTask.id) ? EventType.RetryLearningTaskCompleted : EventType.LearningTaskCompleted,
        durationMs,
        taskType: currentTask.type,
      });
    } else {
      createEvent({
        type: EventType.ShowcaseTaskCompleted,
        durationMs,
      });
    }

    setStartedAt(new Date());
  };

  const onNext = () => {
    createTaskCompletedEvent();

    const nextIdx = idx + 1;
    if (nextIdx < tasks.length || getLearningTasks.isLoading) {
      setIdx(nextIdx);
      return;
    }

    setIsFinished(true);
  };

  const onMistake = (userWordId: number) => {
    setMistakes({ ...mistakes, [userWordId]: (mistakes[userWordId] || 0) + 1 });

    if (!currentTask) {
      throw new Error('Current task is not found');
    }

    if (retryTasks.at(-1)?.originalTaskId !== currentTask.id) {
      setRetryTasks([...retryTasks, { ...currentTask, id: getRetryId(), originalTaskId: currentTask.id }]);
    }

    const userWord = state[userWordId];
    if (!userWord) {
      throw new Error('User word is not found');
    }

    createEvent({
      type: EventType.LearningMistakeMade,
      userWordId,
      taskType: currentTask.type,
    });
  };

  return (
    <div className="space-y-6">
      <div>
        {!isFinished ? (
          <>
            {currentTask?.type === TaskType.Showcase && <ShowcaseCard data={currentTask.data} onNext={onNext} />}

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
              <SentenceToOptions
                key={currentTask.id}
                title="Select the correct translation"
                subtitle="Choose the Ukrainian translation that best matches the English sentence"
                data={currentTask.data}
                onNext={onNext}
                onMistake={onMistake}
              />
            )}

            {currentTask?.type === TaskType.TranslateUkrainianSentence && (
              <SentenceToOptions
                key={currentTask.id}
                title="Select the correct translation"
                subtitle="Choose the English sentence that best matches the Ukrainian sentence"
                data={currentTask.data}
                onNext={onNext}
                onMistake={onMistake}
              />
            )}

            {currentTask?.type === TaskType.FillInTheGap && (
              <TextToWord
                key={currentTask.id}
                title="Fill in the gap"
                subtitle="Type the correct word for the given sentence"
                data={currentTask.data}
                onNext={onNext}
                onMistake={onMistake}
              />
            )}

            {currentTask?.type === TaskType.SynonymAndAntonym && (
              <SynonymAndAntonymToWord
                key={currentTask.id}
                title="What word matches this synonym and antonym?"
                subtitle="Type the word that has both the given synonym and antonym"
                data={currentTask.data}
                onNext={onNext}
                onMistake={onMistake}
              />
            )}

            {currentTask?.type === TaskType.FindIncorrectSentence && (
              <WordToOptions
                key={currentTask.id}
                title="Find the incorrect sentence"
                subtitle="Choose the sentence where the word or phrase is used incorrectly"
                data={currentTask.data}
                onNext={onNext}
                onMistake={onMistake}
              />
            )}

            {currentTask?.type === TaskType.UsageDescriptionToWord && (
              <TextToWord
                key={currentTask.id}
                title="Which word matches this usage?"
                subtitle="Type the word that matches the given usage description"
                data={currentTask.data}
                onNext={onNext}
                onMistake={onMistake}
              />
            )}

            {currentTask?.type === TaskType.WordOrder && (
              <WordOrder
                key={currentTask.id}
                title="Arrange the words in the correct order"
                subtitle="Click words to build the sentence in the correct order"
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
