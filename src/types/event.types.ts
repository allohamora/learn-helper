import type { Status, TaskType } from './user-words.types';

export enum EventType {
  WordDiscovered = 'word-discovered',
  LearningMistakeMade = 'learning-mistake-made',
  LearningTaskCompleted = 'learning-task-completed',
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
      type: EventType.LearningTaskCompleted;
      data: {
        duration: number; // in ms
        taskType: TaskType;
        isRetry: boolean;
      };
    }
  | {
      type: EventType.WordMovedToNextStep;
      userWordId: number;
    };
