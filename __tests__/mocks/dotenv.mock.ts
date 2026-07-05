import { join } from 'node:path';
import { config } from 'dotenv';
import { vitest } from 'vitest';

const workerId = Number(process.env.VITEST_WORKER_ID ?? '0');

process.env.POSTGRES_URL = `postgres://app:example@localhost:5432/test_${workerId}`;
process.env.PINO_LEVEL = 'fatal';

config({ path: join(__dirname, '..', '..', '.env.example'), quiet: true });

vitest.mock('dotenv/config', () => ({}));
