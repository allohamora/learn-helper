import { join } from 'node:path';
import { config, parse } from 'dotenv';
import { vitest } from 'vitest';
import { readFileSync } from 'node:fs';

config({ path: join(__dirname, '..', '..', '..', '.env.example'), quiet: true });

const { OPENROUTER_API_KEY } = parse(readFileSync(join(__dirname, '..', '..', '..', '.env')));

process.env.OPENROUTER_API_KEY = OPENROUTER_API_KEY;

vitest.mock('dotenv/config', () => ({}));
