import viteReact from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { defineConfig } from 'vite';
import { devtools } from '@tanstack/devtools-vite';
import { tanstackStart } from '@tanstack/react-start/plugin/vite';
import { nitro } from 'nitro/vite';

export default defineConfig({
  resolve: { tsconfigPaths: true },
  plugins: [
    devtools(),
    tanstackStart(),
    nitro({
      // https://github.com/nitrojs/nitro/issues/2973
      preset: './src/server/preset.ts',
    }),
    viteReact(),
    tailwindcss(),
  ],
});
