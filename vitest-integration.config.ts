/// <reference types="vitest" />
import tsconfigPathsPlugin from 'vite-tsconfig-paths';
import { getViteConfig } from 'astro/config';

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
    include: ['**/__tests__/integration/**/*.spec.ts'],
    setupFiles: ['./__tests__/mocks/astro-env.mock.ts'],
  },
  plugins: [tsconfigPathsPlugin()],
});
