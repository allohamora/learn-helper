import { getUserWords, getWaitingWords, updateUserWordStatus } from '@/repositories/user-word.repository';
import { levels, lists, statuses } from '@/types/user-words.types';
import { defineAction } from 'astro:actions';
import { z } from 'astro:schema';

export const server = {
  getUserWords: defineAction({
    input: z.object({
      level: z.enum(levels).optional(),
      list: z.enum(lists).optional(),
      status: z.enum(statuses).optional(),
      cursor: z.string().optional(),
      limit: z.number().min(1).max(100).default(50),
    }),
    handler: async (data, context) => {
      const { userId } = context.locals.auth();
      if (!userId) {
        throw new Error('Unauthorized');
      }

      return await getUserWords({ userId, ...data });
    },
  }),
  getWaitingWords: defineAction({
    input: z.object({
      limit: z.number().min(1).max(50).default(10),
    }),
    handler: async (data, context) => {
      const { userId } = context.locals.auth();
      if (!userId) {
        throw new Error('Unauthorized');
      }

      return await getWaitingWords(userId, data.limit);
    },
  }),
  updateWordStatus: defineAction({
    input: z.object({
      id: z.number(),
      status: z.enum(statuses),
    }),
    handler: async (data, context) => {
      const { userId } = context.locals.auth();
      if (!userId) {
        throw new Error('Unauthorized');
      }

      await updateUserWordStatus(data.id, data.status);
      return { success: true };
    },
  }),
};
