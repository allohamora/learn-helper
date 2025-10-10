import { getLearningWords } from '@/repositories/user-word.repository';
import type { AuthParams } from '@/types/auth.types';
import {
  TaskType,
  type DefinitionToWordTask,
  type LearningTask,
  type ShowcaseTask,
  type UserWord,
  type WordToDefinitionTask,
} from '@/types/user-words.types';
import { randomUUID } from 'node:crypto';

const shuffle = <T>(array: T[]): T[] => {
  return array
    .map((value) => ({ value, sort: Math.random() }))
    .sort((a, b) => a.sort - b.sort)
    .map(({ value }) => value);
};

const toShowcaseTasks = (words: UserWord[]) => {
  return words.map(
    (item): ShowcaseTask => ({
      type: TaskType.Showcase,
      data: item.word,
    }),
  );
};

const toWordToDefinitionTasks = (words: UserWord[]) => {
  return words.map((target): WordToDefinitionTask => {
    const wrong = shuffle(words)
      .slice(0, 3)
      .map((value) => ({ definition: value.word.definition, isCorrect: false }));
    const correct = { definition: target.word.definition, isCorrect: true };
    const options = shuffle([correct, ...wrong]);

    return {
      id: randomUUID(),
      type: TaskType.WordToDefinition,
      data: {
        target: target.word,
        options,
      },
    };
  });
};

const toDefinitionToWordTasks = (words: UserWord[]) => {
  return words.map((target): DefinitionToWordTask => {
    const wrong = shuffle(words)
      .slice(0, 3)
      .map((value) => ({ value: value.word.value, partOfSpeech: value.word.partOfSpeech, isCorrect: false }));
    const correct = { value: target.word.value, partOfSpeech: target.word.partOfSpeech, isCorrect: true };
    const options = shuffle([correct, ...wrong]);

    return {
      id: randomUUID(),
      type: TaskType.DefinitionToWord,
      data: {
        target: { definition: target.word.definition },
        options,
      },
    };
  });
};

export const getLearningTasks = async (params: AuthParams<{ limit?: number }>) => {
  const words = await getLearningWords(params);

  const showcaseTasks = toShowcaseTasks(words);
  const wordToDefinitionTasks = toWordToDefinitionTasks(words);
  const definitionToWordTasks = toDefinitionToWordTasks(words);

  return [...showcaseTasks, ...wordToDefinitionTasks, ...definitionToWordTasks] as LearningTask[];
};
