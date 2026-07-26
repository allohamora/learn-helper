import '@tanstack/react-start/server-only';
import * as schema from './db.schema';
import path from 'node:path';
import postgres from 'postgres';
import { drizzle } from 'drizzle-orm/postgres-js';
import { migrate } from 'drizzle-orm/postgres-js/migrator';
import { sql } from 'drizzle-orm';
import { DRIZZLE_DEBUG, POSTGRES_DB, POSTGRES_HOST, POSTGRES_PASSWORD, POSTGRES_PORT, POSTGRES_USER } from '../config';
import { createLogger } from '../utils/logger.utils';

const logger = createLogger('db.service');

export const client = postgres({
  host: POSTGRES_HOST,
  port: POSTGRES_PORT,
  database: POSTGRES_DB,
  username: POSTGRES_USER,
  password: POSTGRES_PASSWORD,
  onnotice: ({ message, ...notice }) => logger.debug({ msg: message, ...notice }),
});
export const db = drizzle(client, { schema, logger: DRIZZLE_DEBUG, casing: 'snake_case' });

const MIGRATIONS_DIR = path.join(process.cwd(), 'migrations');

export const runMigrations = async () => {
  await migrate(db, { migrationsFolder: MIGRATIONS_DIR });
};

export const disconnectFromDb = async () => {
  await client.end();
};

export const clearDb = async () => {
  const query = sql<{
    table_name: string;
  }>`SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' AND table_type = 'BASE TABLE';`;
  const tables = await db.execute(query);

  for (const table of tables) {
    const query = sql.raw(`TRUNCATE TABLE "${table.table_name}" CASCADE;`);
    await db.execute(query);
  }
};
