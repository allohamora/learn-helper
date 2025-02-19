import { getArticle } from '@/services/article.service';
import { defineAction } from 'astro:actions';
import { z } from 'zod';

export const server = {
  getArticle: defineAction({
    input: z.string(),
    handler: getArticle,
  }),
};
