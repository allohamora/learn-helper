import type { Status } from './user-words.types';

export enum EventType {
  WordDiscovered = 'word-discovered',
  WordMovedToNextStep = 'word-moved-to-next-step',
}

export type EventBody =
  | {
      type: EventType.WordDiscovered;
      userWordId: number;
      status: Status;
      durationMs: number;
    }
  | {
      type: EventType.WordMovedToNextStep;
      userWordId: number;
    };
