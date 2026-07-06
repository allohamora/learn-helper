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
          sequence: {
            groupOrder: 0,
          },
        },
      },
      {
        resolve: {
          tsconfigPaths: true,
        },
        test: {
          name: 'integration',
          include: ['**/__tests__/integration/**/*.spec.ts'],
          setupFiles: ['./__tests__/setup-integration-context.ts'],
          maxWorkers: 5,
          sequence: {
            groupOrder: 1,
          },
        },
      },
      {
        resolve: {
          tsconfigPaths: true,
        },
        test: {
          name: 'e2e',
          include: ['**/__tests__/e2e/**/*.spec.ts'],
          setupFiles: ['./__tests__/setup-e2e-context.ts'],
          maxWorkers: 5,
          sequence: {
            groupOrder: 2,
          },
        },
      },
    ],
  },
});
