import { getUserWords } from '@/repositories/user-word.repository';
import { defineAction } from 'astro:actions';
import { z } from 'astro:schema';

export const server = {
  getUserWords: defineAction({
    input: z.object({
      level: z.enum(['a1', 'a2', 'b1', 'b2', 'c1']).optional(),
      list: z.enum(['oxford-5000-words', 'oxford-phrase-list']).optional(),
      status: z.enum(['waiting', 'learning', 'known', 'learned']).optional(),
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
};
