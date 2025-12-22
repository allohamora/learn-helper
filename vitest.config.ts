/// <reference types="vitest" />
import tsconfigPathsPlugin from 'vite-tsconfig-paths';
import { getViteConfig } from 'astro/config';

export default getViteConfig({
  test: {
    watch: false,
    include: ['**/__tests__/unit/**/*.spec.ts'],
    setupFiles: ['./__tests__/mocks/astro-env.mock.ts'],
  },
  plugins: [tsconfigPathsPlugin()],
});
