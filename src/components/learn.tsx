import { type FC, useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from '@tanstack/react-router';
import { Button } from '@/components/ui/button';
import { EventType, UserVocabularyItemTaskType } from '@/const/event';
import { useCreateVocabularyListLearnEvents } from '@/hooks/use-create-vocabulary-list-learn-events';
import { appClient } from '@/services/api';
import type {
  DefinitionToVocabularyItemTask,
  LearnItem,
  LearnTask,
  LearnTasksData,
  PronunciationToVocabularyItemTask,
  ShowcaseTask,
  TranslateEnglishSentenceTask,
  TranslateUkrainianSentenceTask,
  TranslationToVocabularyItemTask,
  VocabularyItemToDefinitionTask,
  VocabularyItemToTranslationTask,
} from '@/types/learn';
import { LearnShowcaseCard } from './learn-showcase-card';
import { PronunciationToVocabularyItem } from './pronunciation-to-vocabulary-item';
import { LearnResult } from './learn-result';
import { TextToVocabularyItem } from './text-to-vocabulary-item';
import { VocabularyItemToOptions } from './vocabulary-item-to-options';
import { WordOrder } from './word-order';
import { Loader } from './ui/loader';

type Props = {
  userVocabularyListId: string;
};

const shuffle = <T,>(array: T[]): T[] => {
  return array
    .map((value) => ({ value, sort: Math.random() }))
    .toSorted((a, b) => a.sort - b.sort)
    .map(({ value }) => value);
};

// gemini-2.5-flash-lite trained on data with periods at the end of sentences
// because of that you can or have dots with questions and exclamations
// or don't have them at all
// gpt-5-nano needs other hacks to work correctly, like schema should be an object instead of an array,
// prompt tricks, disabled reasoning (because with it you will have a 1 minute request for a task) and etc
const removePeriods = (text: string) => text.replace(/\.$/gm, '');

const toShowcaseTasks = (items: LearnItem[]) => {
  return items.map((item): ShowcaseTask => ({
    id: crypto.randomUUID(),
    type: UserVocabularyItemTaskType.Showcase,
    data: {
      ...item.vocabularyItem,
      id: item.id,
    },
  }));
};

const toVocabularyItemToDefinitionTasks = (items: LearnItem[]) => {
  return items.map((target): VocabularyItemToDefinitionTask => {
    const alternatives = shuffle(items)
      .filter((item) => item.id !== target.id)
      .slice(0, 3)
      .map((item) => ({ value: item.vocabularyItem.definition, isAnswer: false }));
    const answer = { value: target.vocabularyItem.definition, isAnswer: true };
    const options = shuffle([answer, ...alternatives]);

    return {
      id: crypto.randomUUID(),
      type: UserVocabularyItemTaskType.VocabularyItemToDefinition,
      data: {
        ...target.vocabularyItem,
        id: target.id,
        options,
        hint: target.vocabularyItem.uaTranslation,
      },
    };
  });
};

const toDefinitionToVocabularyItemTasks = (items: LearnItem[]) => {
  return items.map((target): DefinitionToVocabularyItemTask => {
    return {
      id: crypto.randomUUID(),
      type: UserVocabularyItemTaskType.DefinitionToVocabularyItem,
      data: {
        id: target.id,
        text: target.vocabularyItem.definition,
        vocabularyItem: target.vocabularyItem.value,
        hint: target.vocabularyItem.uaTranslation,
      },
    };
  });
};

const toVocabularyItemToTranslationTasks = (items: LearnItem[]): VocabularyItemToTranslationTask[] => {
  return items.map((target): VocabularyItemToTranslationTask => {
    const alternatives = shuffle(items)
      .filter((item) => item.id !== target.id)
      .slice(0, 3)
      .map((item) => ({ value: item.vocabularyItem.uaTranslation, isAnswer: false }));

    const answer = { value: target.vocabularyItem.uaTranslation, isAnswer: true };
    const options = shuffle([answer, ...alternatives]);

    return {
      id: crypto.randomUUID(),
      type: UserVocabularyItemTaskType.VocabularyItemToTranslation,
      data: {
        ...target.vocabularyItem,
        id: target.id,
        options,
        hint: target.vocabularyItem.definition,
      },
    };
  });
};

const toTranslationToVocabularyItemTasks = (items: LearnItem[]): TranslationToVocabularyItemTask[] => {
  return items.map((target): TranslationToVocabularyItemTask => {
    return {
      id: crypto.randomUUID(),
      type: UserVocabularyItemTaskType.TranslationToVocabularyItem,
      data: {
        id: target.id,
        text: target.vocabularyItem.uaTranslation,
        vocabularyItem: target.vocabularyItem.value,
        hint: target.vocabularyItem.definition,
      },
    };
  });
};

const toPronunciationToVocabularyItemTasks = (items: LearnItem[]): PronunciationToVocabularyItemTask[] => {
  return items.map((item) => {
    return {
      id: crypto.randomUUID(),
      type: UserVocabularyItemTaskType.PronunciationToVocabularyItem,
      data: {
        id: item.id,
        vocabularyItem: item.vocabularyItem.value,
        pronunciation: item.vocabularyItem.pronunciation,
        spelling: item.vocabularyItem.spelling,
      },
    };
  });
};

export const toClientTasks = (items: LearnItem[]): LearnTask[] => {
  const showcaseTasks = toShowcaseTasks(items);
  const vocabularyItemToDefinitionTasks = toVocabularyItemToDefinitionTasks(items);
  const definitionToVocabularyItemTasks = toDefinitionToVocabularyItemTasks(items);
  const vocabularyItemToTranslationTasks = toVocabularyItemToTranslationTasks(items);
  const translationToVocabularyItemTasks = toTranslationToVocabularyItemTasks(items);
  const pronunciationToVocabularyItemTasks = toPronunciationToVocabularyItemTasks(items);

  return [
    ...showcaseTasks,
    ...shuffle(vocabularyItemToDefinitionTasks),
    ...shuffle(definitionToVocabularyItemTasks),
    ...shuffle(vocabularyItemToTranslationTasks),
    ...shuffle(translationToVocabularyItemTasks),
    ...shuffle(pronunciationToVocabularyItemTasks),
  ];
};

const toTranslateEnglishSentenceTasks = (
  tasks: LearnTasksData['translateEnglishSentenceTasks'],
): TranslateEnglishSentenceTask[] => {
  return tasks.map(({ id, sentence, translation }) => {
    const originalWords = removePeriods(translation)
      .split(' ')
      .filter((word) => !!word.trim());

    return {
      id: crypto.randomUUID(),
      type: UserVocabularyItemTaskType.TranslateEnglishSentence,
      data: {
        id,
        sentence: removePeriods(sentence),
        originalWords,
        shuffledWords: shuffle(originalWords),
      },
    };
  });
};

const toTranslateUkrainianSentenceTasks = (
  tasks: LearnTasksData['translateUkrainianSentenceTasks'],
): TranslateUkrainianSentenceTask[] => {
  return tasks.map(({ id, sentence, translation }) => {
    const originalWords = removePeriods(translation)
      .split(' ')
      .filter((word) => !!word.trim());

    return {
      id: crypto.randomUUID(),
      type: UserVocabularyItemTaskType.TranslateUkrainianSentence,
      data: {
        id,
        sentence: removePeriods(sentence),
        originalWords,
        shuffledWords: shuffle(originalWords),
      },
    };
  });
};

export const toServerTasks = (_items: LearnItem[], tasks: LearnTasksData): LearnTask[] => {
  const translateEnglishSentenceTasks = toTranslateEnglishSentenceTasks(tasks.translateEnglishSentenceTasks);
  const translateUkrainianSentenceTasks = toTranslateUkrainianSentenceTasks(tasks.translateUkrainianSentenceTasks);

  return [...shuffle(translateEnglishSentenceTasks), ...shuffle(translateUkrainianSentenceTasks)];
};

const getRetryId = () => `retry-${crypto.randomUUID()}`;
const isRetryId = (id: string) => id.startsWith('retry-');

export const Learn: FC<Props> = ({ userVocabularyListId }) => {
  const [idx, setIdx] = useState(0);
  const [mistakes, setMistakes] = useState<Record<string, number>>({});
  const [isFinished, setIsFinished] = useState(false);
  const [retryTasks, setRetryTasks] = useState<(LearnTask & { originalTaskId: string })[]>([]);
  const [startedAt, setStartedAt] = useState(new Date());

  const learnItemsQuery = useQuery({
    queryKey: ['vocabulary-list-learn-items', userVocabularyListId],
    queryFn: async () => {
      const response = await appClient.api.v1.users.me['vocabulary-lists'][':userVocabularyListId'].learn.items.$get({
        param: { userVocabularyListId },
      });
      if (!response.ok) throw new Error('Failed to load learn items');
      return (await response.json()).data;
    },
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
  });

  const learnTasksQuery = useQuery({
    queryKey: ['vocabulary-list-learn-tasks', userVocabularyListId],
    queryFn: async () => {
      const response = await appClient.api.v1.users.me['vocabulary-lists'][':userVocabularyListId'].learn.tasks.$get({
        param: { userVocabularyListId },
      });
      if (!response.ok) throw new Error('Failed to load learn tasks');
      return (await response.json()).data;
    },
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
  });

  const { createVocabularyListLearnEvent } = useCreateVocabularyListLearnEvents(userVocabularyListId);

  // to preserve the same task ids between re-renders
  const clientTasks = useMemo(() => {
    if (!learnItemsQuery.data) {
      return [];
    }

    return toClientTasks(learnItemsQuery.data);
  }, [learnItemsQuery.data]);

  // to preserve the same task ids between re-renders
  const serverTasks = useMemo(() => {
    if (!learnItemsQuery.data || !learnTasksQuery.data) {
      return [];
    }

    return toServerTasks(learnItemsQuery.data, learnTasksQuery.data);
  }, [learnItemsQuery.data, learnTasksQuery.data]);

  const tasks = [...clientTasks, ...serverTasks, ...retryTasks];

  const state = useMemo(() => {
    if (!learnItemsQuery.data) {
      return {};
    }

    return learnItemsQuery.data.reduce<Record<string, LearnItem>>((state, item) => {
      state[item.id] = item;

      return state;
    }, {});
  }, [learnItemsQuery.data]);

  if (learnItemsQuery.error || learnTasksQuery.error) {
    return (
      <div className="space-y-6">
        <div className="mx-auto max-w-2xl text-center">
          <h1 className="mb-4 text-2xl font-bold">Something went wrong</h1>
          <p className="mb-6 text-muted-foreground">Failed to load learn data. Please try again.</p>
          <Button size="lg" asChild>
            <Link to="/vocabulary-lists/$userVocabularyListId/learn" params={{ userVocabularyListId }} reloadDocument>
              Try Again
            </Link>
          </Button>
        </div>
      </div>
    );
  }

  if (learnItemsQuery.isLoading || !learnItemsQuery.data) {
    return (
      <div className="flex items-center justify-center">
        <Loader />
      </div>
    );
  }

  if (!tasks || tasks.length === 0) {
    return (
      <div className="space-y-6">
        <div className="mx-auto max-w-2xl text-center">
          <h1 className="mb-4 text-2xl font-bold">No Items to Learn</h1>
          <p className="mb-6 text-lg text-muted-foreground">You have no items to learn at the moment.</p>
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

    if (currentTask.type === UserVocabularyItemTaskType.Showcase) {
      createVocabularyListLearnEvent({
        type: EventType.UserVocabularyItemTaskShowcaseViewed,
        userVocabularyItemId: currentTask.data.id,
        durationMs,
      });
    } else {
      createVocabularyListLearnEvent({
        type: isRetryId(currentTask.id)
          ? EventType.UserVocabularyItemTaskRetryPassed
          : EventType.UserVocabularyItemTaskPassed,
        userVocabularyItemId: currentTask.data.id,
        durationMs,
        userVocabularyItemTaskType: currentTask.type,
      });
    }

    setStartedAt(new Date());
  };

  const onNext = () => {
    createTaskCompletedEvent();

    const nextIdx = idx + 1;
    if (nextIdx < tasks.length || learnTasksQuery.isLoading) {
      setIdx(nextIdx);
      return;
    }

    setIsFinished(true);
  };

  const onMistake = (userVocabularyItemId: string) => {
    setMistakes({ ...mistakes, [userVocabularyItemId]: (mistakes[userVocabularyItemId] || 0) + 1 });

    if (!currentTask) {
      throw new Error('Current task is not found');
    }

    if (retryTasks.at(-1)?.originalTaskId !== currentTask.id) {
      setRetryTasks([...retryTasks, { ...currentTask, id: getRetryId(), originalTaskId: currentTask.id }]);
    }

    const item = state[userVocabularyItemId];
    if (!item) {
      throw new Error('Vocabulary item is not found');
    }

    createVocabularyListLearnEvent({
      type: EventType.UserVocabularyItemTaskFailed,
      userVocabularyItemId,
      userVocabularyItemTaskType: currentTask.type,
    });
  };

  return (
    <div className="space-y-6">
      <div>
        {!isFinished ? (
          <>
            {currentTask?.type === UserVocabularyItemTaskType.Showcase && (
              <LearnShowcaseCard data={currentTask.data} onNext={onNext} item={state[currentTask.data.id]} />
            )}

            {currentTask?.type === UserVocabularyItemTaskType.VocabularyItemToDefinition && (
              <VocabularyItemToOptions
                key={currentTask.id}
                title="What does this item mean?"
                subtitle="Select the correct definition for the given item"
                userVocabularyListId={userVocabularyListId}
                taskType={UserVocabularyItemTaskType.VocabularyItemToDefinition}
                data={currentTask.data}
                onNext={onNext}
                onMistake={onMistake}
              />
            )}

            {currentTask?.type === UserVocabularyItemTaskType.DefinitionToVocabularyItem && (
              <TextToVocabularyItem
                key={currentTask.id}
                title="Which item matches this definition?"
                subtitle="Type the correct item for the given definition"
                userVocabularyListId={userVocabularyListId}
                taskType={UserVocabularyItemTaskType.DefinitionToVocabularyItem}
                data={currentTask.data}
                onNext={onNext}
                onMistake={onMistake}
              />
            )}

            {currentTask?.type === UserVocabularyItemTaskType.VocabularyItemToTranslation && (
              <VocabularyItemToOptions
                key={currentTask.id}
                title="What is the correct translation?"
                subtitle="Select the Ukrainian translation for the given item"
                userVocabularyListId={userVocabularyListId}
                taskType={UserVocabularyItemTaskType.VocabularyItemToTranslation}
                data={currentTask.data}
                onNext={onNext}
                onMistake={onMistake}
              />
            )}

            {currentTask?.type === UserVocabularyItemTaskType.TranslationToVocabularyItem && (
              <TextToVocabularyItem
                key={currentTask.id}
                title="Which item matches this translation?"
                subtitle="Type the correct item for the given translation"
                userVocabularyListId={userVocabularyListId}
                taskType={UserVocabularyItemTaskType.TranslationToVocabularyItem}
                data={currentTask.data}
                onNext={onNext}
                onMistake={onMistake}
              />
            )}

            {currentTask?.type === UserVocabularyItemTaskType.PronunciationToVocabularyItem && (
              <PronunciationToVocabularyItem
                key={currentTask.id}
                data={currentTask.data}
                userVocabularyListId={userVocabularyListId}
                taskType={UserVocabularyItemTaskType.PronunciationToVocabularyItem}
                onNext={onNext}
                onMistake={onMistake}
              />
            )}

            {currentTask?.type === UserVocabularyItemTaskType.TranslateEnglishSentence && (
              <WordOrder
                key={currentTask.id}
                title="Arrange the Ukrainian translation"
                subtitle="Select words to build the Ukrainian sentence in the correct order"
                data={currentTask.data}
                onNext={onNext}
                onMistake={onMistake}
              />
            )}

            {currentTask?.type === UserVocabularyItemTaskType.TranslateUkrainianSentence && (
              <WordOrder
                key={currentTask.id}
                title="Arrange the English translation"
                subtitle="Select words to build the English sentence in the correct order"
                data={currentTask.data}
                onNext={onNext}
                onMistake={onMistake}
              />
            )}

            {!currentTask && learnTasksQuery.isLoading && (
              <div className="flex items-center justify-center">
                <Loader />
              </div>
            )}
          </>
        ) : (
          <LearnResult userVocabularyListId={userVocabularyListId} items={learnItemsQuery.data} mistakes={mistakes} />
        )}
      </div>
    </div>
  );
};
