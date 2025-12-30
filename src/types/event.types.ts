import type { Status, TaskType } from './user-words.types';

export enum EventType {
  WordDiscovered = 'word-discovered',
  LearningMistakeMade = 'learning-mistake-made',
  ShowcaseTaskCompleted = 'showcase-task-completed',
  LearningTaskCompleted = 'learning-task-completed',
  RetryLearningTaskCompleted = 'retry-learning-task-completed',
  WordMovedToNextStep = 'word-moved-to-next-step',
  TaskCost = 'task-cost',
  HintViewed = 'hint-viewed',
}

export type ClientEventBody =
  | {
      type: EventType.WordDiscovered;
      userWordId: number;
      status: Status;
      durationMs: number;
    }
  | {
      type: EventType.LearningMistakeMade;
      userWordId: number;
      taskType: TaskType;
    }
  | {
      type: EventType.ShowcaseTaskCompleted;
      durationMs: number;
    }
  | {
      type: EventType.LearningTaskCompleted | EventType.RetryLearningTaskCompleted;
      durationMs: number;
      taskType: TaskType;
    }
  | {
      type: EventType.WordMovedToNextStep;
      userWordId: number;
    }
  | {
      type: EventType.HintViewed;
      userWordId: number;
      taskType: TaskType;
    };

export type EventBody =
  | ClientEventBody
  | {
      type: EventType.TaskCost;
      taskType: TaskType;
      userWordIds: number[];
      costInNanoDollars: number;
      inputTokens?: number;
      outputTokens?: number;
    };
