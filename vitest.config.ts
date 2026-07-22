import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    projects: [
      {
        resolve: {
          tsconfigPaths: true,
        },
        test: {
          name: 'client-unit',
          include: ['**/__tests__/client/unit/**/*.spec.ts'],
          environment: 'happy-dom',
          setupFiles: ['./__tests__/client/setup-unit-context.ts'],
          maxWorkers: 5,
        },
      },
      {
        resolve: {
          tsconfigPaths: true,
        },
        test: {
          name: 'server-unit',
          include: ['**/__tests__/server/unit/**/*.spec.ts'],
          setupFiles: ['./__tests__/server/setup-unit-context.ts'],
          maxWorkers: 5,
        },
      },
      {
        resolve: {
          tsconfigPaths: true,
        },
        test: {
          name: 'integration',
          include: ['**/__tests__/server/integration/**/*.spec.ts'],
          setupFiles: ['./__tests__/server/setup-integration-context.ts'],
          maxWorkers: 5,
        },
      },
      {
        resolve: {
          tsconfigPaths: true,
        },
        test: {
          name: 'e2e',
          include: ['**/__tests__/server/e2e/**/*.spec.ts'],
          setupFiles: ['./__tests__/server/setup-e2e-context.ts'],
          maxWorkers: 5,
        },
      },
      {
        resolve: {
          tsconfigPaths: true,
        },
        test: {
          name: 'evals',
          include: ['**/__tests__/server/evals/**/*.spec.ts'],
          setupFiles: ['./__tests__/server/setup-evals-context.ts'],
          testTimeout: 5 * 60 * 1000,
          maxWorkers: 5,
        },
      },
    ],
  },
});
