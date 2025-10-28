import { getLearningWords, getUserWords, getWaitingWords } from '@/repositories/user-word.repository';
import { createEvents, getStatistics } from '@/services/event.service';
import { moveUserWordToNextStep, getLearningTasks, setDiscoveryStatus } from '@/services/user-word.service';
import type { AuthParams } from '@/types/auth.types';
import { Level, List, Status, TaskType } from '@/types/user-words.types';
import { EventType } from '@/types/event.types';
import { defineAction, type ActionAPIContext } from 'astro:actions';
import { z } from 'astro:schema';

const auth = <T, R>(fn: (data: AuthParams<T>) => Promise<R>) => {
  return async (data: T, context: ActionAPIContext) => {
    const { userId } = context.locals.auth();
    if (!userId) {
      throw new Error('Unauthorized');
    }

    return await fn({ ...data, userId });
  };
};

export const server = {
  getUserWords: defineAction({
    input: z.object({
      level: z.nativeEnum(Level).optional(),
      list: z.nativeEnum(List).optional(),
      status: z.nativeEnum(Status).optional(),
      cursor: z.string().optional(),
      limit: z.number().min(1).max(100).default(50),
    }),
    handler: auth(getUserWords),
  }),
  getWaitingWords: defineAction({
    input: z.object({
      limit: z.number().min(1).max(50).default(10),
    }),
    handler: auth(getWaitingWords),
  }),
  setDiscoveryStatus: defineAction({
    input: z.object({
      userWordId: z.number(),
      status: z.enum([Status.Known, Status.Learning, Status.Waiting]),
    }),
    handler: auth(setDiscoveryStatus),
  }),
  getLearningWords: defineAction({
    input: z.object({
      limit: z.number().min(1).max(10).default(6),
    }),
    handler: auth(getLearningWords),
  }),
  getLearningTasks: defineAction({
    input: z.object({
      limit: z.number().min(1).max(10).default(6),
    }),
    handler: auth(getLearningTasks),
  }),
  moveUserWordToNextStep: defineAction({
    input: z.object({
      userWordId: z.number(),
    }),
    handler: auth(moveUserWordToNextStep),
  }),
  createEvents: defineAction({
    input: z.object({
      body: z.array(
        z.union([
          z.object({
            type: z.literal(EventType.DiscoveryWordStatusChanged),
            userWordId: z.number(),
            data: z.object({
              status: z.nativeEnum(Status),
            }),
          }),
          z.object({
            type: z.literal(EventType.LearningSessionCompleted),
            data: z.object({
              duration: z.number(), // in ms
              totalTasks: z.number(),
              totalMistakes: z.number(),
            }),
          }),
          z.object({
            type: z.literal(EventType.WordMovedToNextStep),
            userWordId: z.number(),
          }),
          z.object({
            type: z.literal(EventType.LearningMistakeMade),
            userWordId: z.number(),
            data: z.object({
              type: z.nativeEnum(TaskType),
            }),
          }),
        ]),
      ),
    }),
    handler: auth(createEvents),
  }),
  getStatistics: defineAction({
    input: z.object({
      dateFrom: z.date().default(() => new Date(new Date().setDate(new Date().getDate() - 7))),
      dateTo: z.date().default(() => new Date()),
    }),
    handler: auth(getStatistics),
  }),
};
