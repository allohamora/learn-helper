import { join } from 'node:path';
import { config, parse } from 'dotenv';
import { vitest } from 'vitest';
import { readFileSync } from 'node:fs';

config({ path: join(__dirname, '..', '..', '..', '.env.example'), quiet: true });

const { GEMINI_API_KEY, OPENAI_API_KEY } = parse(readFileSync(join(__dirname, '..', '..', '..', '.env')));

process.env.GEMINI_API_KEY = GEMINI_API_KEY;

// automatically consumed by @ai-sdk/openai
// you will have "Incorrect API key provided: undefined." if not set so we don't need to manually validate it here
process.env.OPENAI_API_KEY = OPENAI_API_KEY;

vitest.mock('dotenv/config', () => ({}));
