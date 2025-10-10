import {
  getUserWords,
  getWaitingWords,
  updateUserWordStatus,
  getLearningWords,
  updateUserWordStatuses,
} from '@/repositories/user-word.repository';
import { getLearningTasks } from '@/services/user-word.service';
import type { AuthParams } from '@/types/auth.types';
import { Level, List, Status } from '@/types/user-words.types';
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
  updateWordStatus: defineAction({
    input: z.object({
      userWordId: z.number(),
      status: z.nativeEnum(Status),
    }),
    handler: auth(updateUserWordStatus),
  }),
  updateUserWordStatuses: defineAction({
    input: z.object({
      data: z.array(
        z.object({
          userWordId: z.number(),
          status: z.nativeEnum(Status),
        }),
      ),
    }),
    handler: auth(updateUserWordStatuses),
  }),
  getLearningWords: defineAction({
    input: z.object({
      limit: z.number().min(1).max(10).default(5),
    }),
    handler: auth(getLearningWords),
  }),
  getLearningTasks: defineAction({
    input: z.object({
      limit: z.number().min(1).max(10).default(5),
    }),
    handler: auth(getLearningTasks),
  }),
};
