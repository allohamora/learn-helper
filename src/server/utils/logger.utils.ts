import '@tanstack/react-start/server-only';
import pinoPretty from 'pino-pretty';
import pino, { type Logger } from 'pino';
import { PINO_LEVEL } from '../config';

export type { Logger };

const logger = pino({ level: PINO_LEVEL }, pinoPretty());

export const createLogger = (name: string) => logger.child({ name });
