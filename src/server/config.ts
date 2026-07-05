import { z } from 'zod';
import 'dotenv/config';

const json = <T extends z.ZodType>(schema: T) =>
  z
    .string()
    .transform((value) => JSON.parse(value))
    .pipe(schema);

export const {
  NODE_ENV,

  POSTGRES_URL,
  DRIZZLE_DEBUG,

  BETTER_AUTH_SECRET,
  BETTER_AUTH_URL,
  BETTER_AUTH_GOOGLE_CLIENT_ID,
  BETTER_AUTH_GOOGLE_CLIENT_SECRET,
  BETTER_AUTH_ALLOWED_USERS,
} = z
  .object({
    NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),

    POSTGRES_URL: z.string(),
    DRIZZLE_DEBUG: z.stringbool().default(false),

    BETTER_AUTH_SECRET: z.string(),
    BETTER_AUTH_URL: z.url(),
    BETTER_AUTH_GOOGLE_CLIENT_ID: z.string(),
    BETTER_AUTH_GOOGLE_CLIENT_SECRET: z.string(),
    BETTER_AUTH_ALLOWED_USERS: json(z.array(z.string())),
  })
  .parse(process.env);
