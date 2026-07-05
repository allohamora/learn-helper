import './mocks';
import { clearDb, disconnectFromDb, runMigrations } from '@/server/db/db.client';
import { beforeAll, afterEach, afterAll } from 'vitest';
import { testClient } from 'hono/testing';
import { app } from '@/server/api';

export const client = testClient(app);

beforeAll(async () => {
  await runMigrations();
});

afterEach(async () => {
  await clearDb();
});

afterAll(async () => {
  await disconnectFromDb();
});
