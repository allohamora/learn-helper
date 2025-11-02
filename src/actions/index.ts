import { getLearningWords, getUserWords, getWaitingWords } from '@/repositories/user-word.repository';
import { createEvents } from '@/services/event.service';
import { moveUserWordToNextStep, getLearningTasks, setDiscoveryStatus } from '@/services/user-word.service';
import type { AuthParams } from '@/types/auth.types';
import { Level, List, Status, TaskType } from '@/types/user-words.types';
import { EventType } from '@/types/event.types';
import { ActionError, defineAction, type ActionAPIContext } from 'astro:actions';
import { z } from 'astro:schema';
import { RateLimiterMemory } from 'rate-limiter-flexible';
import { getStatistics } from '@/services/statistics.service';

const auth = <T, R>(fn: (data: AuthParams<T>) => Promise<R>) => {
  return async (data: T, context: ActionAPIContext) => {
    const { userId } = context.locals.auth();
    if (!userId) {
      throw new ActionError({
        code: 'UNAUTHORIZED',
        message: 'User must be authenticated to perform this action.',
      });
    }

    return await fn({ ...data, userId });
  };
};

const rateLimit = <T, R>(fn: (data: AuthParams<T>) => Promise<R>) => {
  const rateLimiter = new RateLimiterMemory({
    points: 10,
    duration: 60,
  });

  return async (data: AuthParams<T>) => {
    try {
      // throws a plain object with metadata about the rate limit
      await rateLimiter.consume(data.userId);
    } catch {
      throw new ActionError({
        code: 'TOO_MANY_REQUESTS',
        message: 'Too many requests, please try again later.',
      });
    }

    return await fn(data);
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
    input: z.discriminatedUnion('status', [
      z.object({ status: z.literal(Status.Waiting), userWordId: z.number() }),
      z.object({ status: z.enum([Status.Known, Status.Learning]), duration: z.number(), userWordId: z.number() }),
    ]),
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
    handler: auth(rateLimit(getLearningTasks)),
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
        z.discriminatedUnion('type', [
          z.object({
            type: z.literal(EventType.WordDiscovered),
            userWordId: z.number(),
            status: z.nativeEnum(Status),
            duration: z.number(),
          }),
          z.object({
            type: z.literal(EventType.LearningMistakeMade),
            userWordId: z.number(),
            taskType: z.nativeEnum(TaskType),
          }),
          z.object({
            type: z.enum([EventType.LearningTaskCompleted, EventType.RetryLearningTaskCompleted]),
            duration: z.number(),
            taskType: z.nativeEnum(TaskType),
          }),
          z.object({
            type: z.literal(EventType.ShowcaseTaskCompleted),
            duration: z.number(),
          }),
          z.object({
            type: z.literal(EventType.WordMovedToNextStep),
            userWordId: z.number(),
          }),
        ]),
      ),
    }),
    handler: auth(createEvents),
  }),
  getStatistics: defineAction({
    input: z.object({}),
    handler: auth(getStatistics),
  }),
};
