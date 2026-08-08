import '@tanstack/react-start/server-only';
import * as schema from '../db/db.schema';
import { betterAuth } from 'better-auth';
import { drizzleAdapter } from 'better-auth/adapters/drizzle';
import { APIError } from 'better-auth/api';
import { db } from '../db/db.service';
import {
  BETTER_AUTH_GOOGLE_CLIENT_ID,
  BETTER_AUTH_GOOGLE_CLIENT_SECRET,
  BETTER_AUTH_SECRET,
  BETTER_AUTH_URL,
  BETTER_AUTH_ALLOWED_USERS,
} from '../config';
import { createLogger } from '../utils/logger.utils';
import { createPersonalVocabularyListForUser } from '../user-vocabulary/user-vocabulary-list.service';

const logger = createLogger('auth.service');

export const auth = betterAuth({
  database: drizzleAdapter(db, {
    provider: 'pg',
    schema,
  }),
  socialProviders: {
    google: {
      clientId: BETTER_AUTH_GOOGLE_CLIENT_ID,
      clientSecret: BETTER_AUTH_GOOGLE_CLIENT_SECRET,
    },
  },
  databaseHooks: {
    user: {
      create: {
        before: async (user) => {
          if (!BETTER_AUTH_ALLOWED_USERS.includes(user.email)) {
            logger.error({ err: new Error('Unauthorized registration attempt'), user });

            throw new APIError('FORBIDDEN', { message: `User is not allowed to register` });
          }
        },
        after: async (user) => {
          await createPersonalVocabularyListForUser(user.id);
        },
      },
    },
    session: {
      create: {
        before: async (session, ctx) => {
          if (!ctx) return;

          const user = await ctx.context.internalAdapter.findUserById(session.userId);

          if (!user || !BETTER_AUTH_ALLOWED_USERS.includes(user.email)) {
            logger.error({ err: new Error('Unauthorized sign-in attempt'), userId: session.userId });

            throw new APIError('FORBIDDEN', { message: `User is not allowed to sign in` });
          }
        },
      },
    },
  },
  baseURL: BETTER_AUTH_URL,
  secret: BETTER_AUTH_SECRET,
  basePath: '/api/auth',
  onAPIError: {
    errorURL: '/error',
  },
});
