import closeWithGrace from 'close-with-grace';
import { useNitroApp as getNitroApp } from 'nitro/app';
import { serve } from 'srvx/node';
import { createLogger } from './utils/logger.utils';
import { onApplicationStop } from './utils/hook.utils';
import { disconnectFromDb } from './db/db.service';

// https://github.com/nitrojs/nitro/blob/eee0abd9fc4f729445f5b1a4da06fa78daf7a3da/src/presets/node/runtime/node-server.ts
const nitroApp = getNitroApp();

const server = serve({
  port: 3000,
  // Nitro's default node-server entry uses graceful shutdown, but it does not
  // shut this app down correctly, so we use our custom preset to make graceful shutdown work as we need
  // https://github.com/nitrojs/nitro/pull/4017
  gracefulShutdown: false,
  fetch: nitroApp.fetch,
});

const logger = createLogger('preset-entry');

closeWithGrace({ delay: 15_000, logger }, async (props) => {
  logger.info({ msg: 'Graceful shutdown has been started', ...props });

  await server.close();

  await onApplicationStop.run();
  await disconnectFromDb();

  logger.info({ msg: 'Graceful shutdown has been finished', ...props });
});
