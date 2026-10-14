import viteReact from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import pkg from './package.json' with { type: 'json' };
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
    // Without this, the build has two copies of hono's GET_MATCH_RESULT symbol (one inlined in the
    // app chunk via 'hono/route', one in a Nitro _libs chunk), so routePath() throws on every /api request.
    // Add any new package that imports hono here.
    ssr: { noExternal: [/^hono(\/|$)/, /^@hono\//, /^@scalar\/hono-api-reference/] },
    plugins: [
      devtools(),
      tanstackStart(),
      sentryTanstackStart({
        org: SENTRY_ORG,
        project: SENTRY_PROJECT,
        authToken: SENTRY_AUTH_TOKEN,
        release: { name: pkg.version },
        // The default './**/*.map' also deletes the source maps of packages in node_modules.
        sourcemaps: { filesToDeleteAfterUpload: ['./.output/**/*.map'] },
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
