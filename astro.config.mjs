// @ts-check
import { defineConfig, envField } from 'astro/config';
import react from '@astrojs/react';
import tailwind from '@astrojs/tailwind';
import node from '@astrojs/node';

// https://astro.build/config
export default defineConfig({
  output: 'server',
  env: {
    schema: {
      GROQ_API_KEY: envField.string({ context: 'server', access: 'secret' }),
      GROQ_MODEL: envField.string({ context: 'server', access: 'secret' }),
    },
  },
  integrations: [
    react(),
    tailwind({
      applyBaseStyles: false,
    }),
  ],
  adapter: node({
    mode: 'standalone',
  }),
});
