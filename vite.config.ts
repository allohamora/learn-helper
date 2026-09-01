import viteReact from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { defineConfig, loadEnv } from 'vite';
import { devtools } from '@tanstack/devtools-vite';
import { tanstackStart } from '@tanstack/react-start/plugin/vite';
import { nitro } from 'nitro/vite';
import { sentryTanstackStart } from '@sentry/tanstackstart-react/vite';

export default defineConfig(({ mode }) => {
  const { SENTRY_ORG, SENTRY_PROJECT, SENTRY_AUTH_TOKEN, BETTER_AUTH_URL } = loadEnv(mode, process.cwd(), '');

  return {
    server: {
      allowedHosts: BETTER_AUTH_URL ? [new URL(BETTER_AUTH_URL).hostname] : undefined,
    },
    resolve: { tsconfigPaths: true },
    plugins: [
      devtools(),
      tanstackStart(),
      sentryTanstackStart({
        org: SENTRY_ORG,
        project: SENTRY_PROJECT,
        authToken: SENTRY_AUTH_TOKEN,
      }),
      nitro({
        // https://github.com/nitrojs/nitro/issues/2973
        preset: './src/server/preset.ts',
      }),
      viteReact(),
      tailwindcss(),
    ],
  };
});
