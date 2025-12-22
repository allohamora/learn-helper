import { vitest } from 'vitest';
import { parse } from 'dotenv';
import { join } from 'node:path';
import { readFile } from 'node:fs/promises';

// GEMINI_API_KEY is used inside user-word.service
// OPENAI_API_KEY is used inside to-satisfy-statements.expect
const { GEMINI_API_KEY, OPENAI_API_KEY } = parse(await readFile(join(import.meta.dirname, '..', '..', '.env')));
const config = parse(await readFile(join(import.meta.dirname, '..', '..', '.env.example')));

vitest.mock('astro:env/server', () => {
  return {
    ...config,
    GEMINI_API_KEY,
    OPENAI_API_KEY,
  };
});

vitest.mock('astro:env/client', () => {
  return config;
});
