import { defineAction } from 'astro:actions';

export const server = {
  getCurrentUser: defineAction({
    handler: async (_input, ctx) => {
      const user = await ctx.locals.currentUser();

      return { firstName: user?.firstName, lastName: user?.lastName };
    },
  }),
};
