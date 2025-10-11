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
    schema: {
      PUBLIC_CLERK_PUBLISHABLE_KEY: envField.string({ context: 'client', access: 'public' }),
      CLERK_SECRET_KEY: envField.string({ context: 'server', access: 'secret' }),
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
