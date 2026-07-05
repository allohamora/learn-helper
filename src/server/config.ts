import { z } from 'zod';
import 'dotenv/config';

export const {
  NODE_ENV,

  POSTGRES_URL,
  DRIZZLE_DEBUG,
} = z
  .object({
    NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),

    POSTGRES_URL: z.string(),
    DRIZZLE_DEBUG: z.stringbool().default(false),
  })
  .parse(process.env);
