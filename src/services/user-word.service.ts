import { getLearningWords } from '@/repositories/user-word.repository';
import type { AuthParams } from '@/types/auth.types';
import {
  TaskType,
  type DefinitionToWordTask,
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
      id: randomUUID(),
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
      id: randomUUID(),
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
      id: randomUUID(),
      type: TaskType.DefinitionToWord,
      data: {
        id: target.id,
        definition: target.word.definition,
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

  return {
    showcaseTasks,
    wordToDefinitionTasks,
    definitionToWordTasks,
  };
};
