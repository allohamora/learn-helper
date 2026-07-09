import '@tanstack/react-start/server-only';
import pino, { type Logger } from 'pino';
import { PINO_LEVEL } from '../config';

export type { Logger };

const logger = pino({
  level: PINO_LEVEL,
  transport: {
    targets: [
      {
        target: 'pino-pretty',
        level: PINO_LEVEL,
      },
    ],
  },
});

export const createLogger = (name: string) => logger.child({ name });
