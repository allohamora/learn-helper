import { join } from 'node:path';
import { config } from 'dotenv';
import { vitest } from 'vitest';

const poolId = Number(process.env.VITEST_POOL_ID ?? '1');

process.env.POSTGRES_HOST = 'localhost';
process.env.POSTGRES_PORT = '5432';
process.env.POSTGRES_USER = 'app';
process.env.POSTGRES_PASSWORD = 'example';
process.env.POSTGRES_DB = `test_${poolId}`;
process.env.PINO_LEVEL = 'fatal';

config({ path: join(__dirname, '..', '..', '..', '.env.example'), quiet: true });

vitest.mock('dotenv/config', () => ({}));
