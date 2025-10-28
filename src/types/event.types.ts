import type { Status, TaskType } from './user-words.types';

export enum EventType {
  WordDiscovered = 'word-discovered',
  LearningSessionCompleted = 'learning-session-completed',
  WordMovedToNextStep = 'word-moved-to-next-step',
  LearningMistakeMade = 'learning-mistake-made',
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
      type: EventType.LearningSessionCompleted;
      data: {
        duration: number; // in ms
        totalTasks: number;
        totalMistakes: number;
      };
    }
  | {
      type: EventType.WordMovedToNextStep;
      userWordId: number;
    }
  | {
      type: EventType.LearningMistakeMade;
      userWordId: number;
      data: {
        type: TaskType;
      };
    };
