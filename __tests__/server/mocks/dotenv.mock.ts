import { join } from 'node:path';
import { config } from 'dotenv';
import { vitest } from 'vitest';

const poolId = Number(process.env.VITEST_POOL_ID ?? '1');

process.env.POSTGRES_URL = `postgres://app:example@localhost:5432/test_${poolId}`;
process.env.PINO_LEVEL = 'fatal';

config({ path: join(__dirname, '..', '..', '..', '.env.example'), quiet: true });

vitest.mock('dotenv/config', () => ({}));
