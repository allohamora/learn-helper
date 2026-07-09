import { defineNitroConfig } from 'nitro/config';

// https://github.com/nitrojs/nitro/blob/eee0abd9fc4f729445f5b1a4da06fa78daf7a3da/src/presets/node/preset.ts
export default defineNitroConfig({
  extends: 'node-server',
  entry: './src/server/preset-entry.ts',
});
