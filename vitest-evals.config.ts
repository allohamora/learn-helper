/// <reference types="vitest" />
import tsconfigPathsPlugin from 'vite-tsconfig-paths';
import { getViteConfig } from 'astro/config';

// astro adds hacks for astro:db and other imports
// if we use getViteConfig for each project, then we will have several db setups and etc
// because of that we cannot use test.projects as usual
export default getViteConfig({
  test: {
    watch: false,
    maxConcurrency: 10,
    maxWorkers: 10,
    testTimeout: 5 * 60 * 1000, // 5 minutes
    include: ['**/__tests__/evals/**/*.spec.ts'],
    setupFiles: ['./__tests__/mocks/astro-env-evals.mock.ts'],
  },
  plugins: [tsconfigPathsPlugin()],
});
