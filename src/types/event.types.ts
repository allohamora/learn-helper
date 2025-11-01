import type { Status, TaskType } from './user-words.types';

export enum EventType {
  WordDiscovered = 'word-discovered',
  LearningMistakeMade = 'learning-mistake-made',
  ShowcaseTaskCompleted = 'showcase-task-completed',
  LearningTaskCompleted = 'learning-task-completed',
  RetryLearningTaskCompleted = 'retry-learning-task-completed',
  WordMovedToNextStep = 'word-moved-to-next-step',
}

export type EventBody =
  | {
      type: EventType.WordDiscovered;
      userWordId: number;
      data: {
        status: Status;
      };
    }
  | {
      type: EventType.LearningMistakeMade;
      userWordId: number;
      data: {
        taskType: TaskType;
      };
    }
  | {
      type: EventType.ShowcaseTaskCompleted;
      data: {
        duration: number; // in ms
      };
    }
  | {
      type: EventType.LearningTaskCompleted | EventType.RetryLearningTaskCompleted;
      data: {
        duration: number; // in ms
        taskType: TaskType;
      };
    }
  | {
      type: EventType.WordMovedToNextStep;
      userWordId: number;
    };
