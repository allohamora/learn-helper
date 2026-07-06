import type { Config } from 'drizzle-kit';
import 'dotenv/config';

export default {
  schema: './src/server/db/db.schema.ts',
  out: './src/server/db/migrations',
  dialect: 'postgresql',
  casing: 'snake_case',
  dbCredentials: {
    url: process.env.POSTGRES_URL as string,
  },
} satisfies Config;
