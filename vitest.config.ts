import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    projects: [
      {
        resolve: {
          tsconfigPaths: true,
        },
        test: {
          name: 'unit',
          include: ['**/__tests__/unit/**/*.spec.ts'],
          setupFiles: ['./__tests__/setup-unit-context.ts'],
        },
      },
    ],
  },
});
