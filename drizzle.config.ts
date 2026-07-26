import type { Config } from 'drizzle-kit';
import 'dotenv/config';

export default {
  schema: './src/server/db/db.schema.ts',
  out: './migrations',
  dialect: 'postgresql',
  casing: 'snake_case',
  dbCredentials: {
    host: process.env.POSTGRES_HOST as string,
    port: Number(process.env.POSTGRES_PORT ?? 5432),
    user: process.env.POSTGRES_USER as string,
    password: process.env.POSTGRES_PASSWORD as string,
    database: process.env.POSTGRES_DB as string,
  },
} satisfies Config;
