import './mocks';
import { clearDb, disconnectFromDb, runMigrations } from '@/server/db/db.service';
import { beforeAll, afterEach, afterAll } from 'vitest';

beforeAll(async () => {
  await runMigrations();
});

afterEach(async () => {
  await clearDb();
});

afterAll(async () => {
  await disconnectFromDb();
});
