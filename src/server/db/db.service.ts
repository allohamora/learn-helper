import '@tanstack/react-start/server-only';
import * as schema from './db.schema';
import path from 'node:path';
import postgres from 'postgres';
import { drizzle } from 'drizzle-orm/postgres-js';
import { migrate } from 'drizzle-orm/postgres-js/migrator';
import { sql } from 'drizzle-orm';
import { DRIZZLE_DEBUG, POSTGRES_URL } from '../config';
import { createLogger } from '../utils/logger.utils';

const logger = createLogger('db.service');

export const client = postgres(POSTGRES_URL, {
  onnotice: ({ message, ...notice }) => logger.debug({ msg: message, ...notice }),
});
export const db = drizzle(client, { schema, logger: DRIZZLE_DEBUG, casing: 'snake_case' });

const MIGRATIONS_DIR = path.join(process.cwd(), 'migrations');

// Every app replica calls this on boot. drizzle-orm's migrate() has no built-in locking
// (github.com/drizzle-team/drizzle-orm/issues/874), so replicas racing here would apply
// the same migration twice. A session-level advisory lock on a reserved connection
// serializes them: one replica migrates while the rest block, then those no-op once they
// see it's already applied. A crash releases the lock as soon as its connection drops.
export const runMigrations = async () => {
  const reserved = await client.reserve();
  const lock = `hashtext('learn-helper-migrations')`;

  try {
    await reserved.unsafe(`SELECT pg_advisory_lock(${lock})`);
    await migrate(db, { migrationsFolder: MIGRATIONS_DIR });
  } finally {
    await reserved.unsafe(`SELECT pg_advisory_unlock(${lock})`);
    reserved.release();
  }
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
