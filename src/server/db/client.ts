import * as schema from './schema';
import path from 'node:path';
import postgres from 'postgres';
import { drizzle } from 'drizzle-orm/postgres-js';
import { migrate } from 'drizzle-orm/postgres-js/migrator';
import { sql } from 'drizzle-orm';
import { DRIZZLE_DEBUG, POSTGRES_URL } from '../config';

export const client = postgres(POSTGRES_URL);
export const db = drizzle(client, { schema, logger: DRIZZLE_DEBUG, casing: 'snake_case' });

const MIGRATIONS_DIR = path.join(import.meta.dirname, 'migrations');

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
