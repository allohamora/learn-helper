import * as Sentry from '@sentry/tanstackstart-react';
import { nodeProfilingIntegration } from '@sentry/profiling-node';
import { VITE_SENTRY_DSN } from '@/config';
import { NODE_ENV } from './config';

Sentry.init({
  dsn: VITE_SENTRY_DSN,
  enabled: NODE_ENV === 'production',
  integrations: [
    nodeProfilingIntegration(),
    // send all console calls to Sentry logs
    Sentry.consoleLoggingIntegration(),
    // send console.error messages to Sentry issues, by default sends all levels as issues
    Sentry.captureConsoleIntegration({ levels: ['error'] }),
    // error.levels array defines which levels are sent to Sentry as issues
    Sentry.pinoIntegration({ error: { levels: ['error'] } }),
    Sentry.vercelAIIntegration({
      recordInputs: true,
      recordOutputs: true,
    }),
  ],

  // Send structured logs to Sentry
  enableLogs: true,
  // Tracing
  tracesSampleRate: 1.0, //  Capture 100% of the transactions, because we need to store all ai traces for debugging
  // Set sampling rate for profiling - this is evaluated only once per SDK.init call
  profileSessionSampleRate: 1.0,
  // Trace lifecycle automatically enables profiling during active traces
  profileLifecycle: 'trace',
  // Setting this option to true will send default PII data to Sentry.
  // For example, automatic IP address collection on events
  sendDefaultPii: true,

  // See debug logs in the console
  // debug: true,
});

export const startSpan = Sentry.startSpan;
export const setTags = Sentry.setTags;
export const setUser = Sentry.setUser;
export const wrapFetchWithSentry = Sentry.wrapFetchWithSentry;
