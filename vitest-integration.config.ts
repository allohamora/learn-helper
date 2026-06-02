/// <reference types="vitest/config" />
import tsconfigPathsPlugin from 'vite-tsconfig-paths';
import { getViteConfig } from 'astro/config';

export default getViteConfig({
  test: {
    watch: false,
    maxWorkers: 1,
    isolate: false,
    include: ['**/__tests__/integration/**/*.spec.ts'],
    setupFiles: ['./__tests__/mocks/astro-env.mock.ts'],
  },
  plugins: [tsconfigPathsPlugin()],
});
