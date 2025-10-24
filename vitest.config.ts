/// <reference types="vitest" />
import tsconfigPathsPlugin from 'vite-tsconfig-paths';
import { getViteConfig } from 'astro/config';
import { parse } from 'dotenv';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';

export default getViteConfig({
  test: {
    watch: false,
    maxWorkers: 1,
    minWorkers: 1,
    poolOptions: {
      threads: {
        singleThread: true,
        minThreads: 1,
        maxThreads: 1,
      },
      forks: {
        singleFork: true,
        minForks: 1,
        maxForks: 1,
      },
    },
    include: ['**/__tests__/integration/**/*.spec.ts', '**/__tests__/unit/**/*.spec.ts'],
    setupFiles: ['./__tests__/mocks/astro-env.mock.ts'],
  },
  plugins: [tsconfigPathsPlugin()],
});
