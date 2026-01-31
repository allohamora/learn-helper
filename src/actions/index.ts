import { getLearningWords, getUserWords, getWaitingWords } from '@/repositories/user-word.repository';
import { moveUserWordToNextStep, setDiscoveryStatus } from '@/services/user-word.service';
import type { AuthParams } from '@/types/auth.types';
import { Level, List, Status } from '@/types/user-words.types';
import { ActionError, defineAction, type ActionAPIContext } from 'astro:actions';
import { z } from 'astro:schema';
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

export const server = {
  getUserWords: defineAction({
    input: z.object({
      level: z.nativeEnum(Level).optional(),
      list: z.nativeEnum(List).optional(),
      status: z.nativeEnum(Status).optional(),
      search: z.string().trim().optional(),
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
      z.object({ status: z.enum([Status.Known, Status.Learning]), durationMs: z.number(), userWordId: z.number() }),
    ]),
    handler: auth(setDiscoveryStatus),
  }),
  getLearningWords: defineAction({
    input: z.object({
      limit: z.number().min(1).max(10).default(6),
    }),
    handler: auth(getLearningWords),
  }),
  moveUserWordToNextStep: defineAction({
    input: z.object({
      userWordId: z.number(),
    }),
    handler: auth(moveUserWordToNextStep),
  }),
  getStatistics: defineAction({
    input: z.object({}),
    handler: auth(getStatistics),
  }),
};
