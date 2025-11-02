// @ts-check
import { defineConfig, envField } from 'astro/config';
import react from '@astrojs/react';
import tailwindcss from '@tailwindcss/vite';
import node from '@astrojs/node';
import clerk from '@clerk/astro';
import db from '@astrojs/db';

// https://astro.build/config
export default defineConfig({
  output: 'server',
  vite: {
    plugins: [tailwindcss()],
  },
  env: {
    validateSecrets: true,
    schema: {
      // just to have errors if these are missing
      PUBLIC_CLERK_PUBLISHABLE_KEY: envField.string({ context: 'client', access: 'public' }),
      CLERK_SECRET_KEY: envField.string({ context: 'server', access: 'secret' }),
      ASTRO_DB_REMOTE_URL: envField.string({ context: 'server', access: 'secret' }),

      GEMINI_API_KEY: envField.string({ context: 'server', access: 'secret' }),
    },
  },
  integrations: [
    clerk(),
    react({
      babel: {
        plugins: ['babel-plugin-react-compiler'],
      },
    }),
    db(),
  ],
  adapter: node({
    mode: 'standalone',
  }),
});
