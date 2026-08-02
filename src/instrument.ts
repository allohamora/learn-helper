import * as Sentry from '@sentry/tanstackstart-react';
import { IS_PRODUCTION, VITE_SENTRY_DSN } from './config';

Sentry.init({
  dsn: VITE_SENTRY_DSN,
  enabled: IS_PRODUCTION,
  integrations: [
    Sentry.browserTracingIntegration(),
    Sentry.replayIntegration({
      maskAllText: false,
      maskAllInputs: false,
    }),
    // send all console calls to Sentry logs
    Sentry.consoleLoggingIntegration(),
    // send console.error messages to Sentry issues, by default sends all levels as issues
    Sentry.captureConsoleIntegration({ levels: ['error'] }),
    Sentry.feedbackIntegration({
      // we will create this widget only for authenticated users
      autoInject: false,

      // https://docs.sentry.io/platforms/javascript/user-feedback/configuration/#general
      colorScheme: 'system',
      showBranding: false,

      // https://docs.sentry.io/platforms/javascript/user-feedback/configuration/#text-customization
      // by default bug instead of feedback
      triggerLabel: 'Send Feedback',
      formTitle: 'Send Feedback',
      submitButtonLabel: 'Send Feedback',
      messagePlaceholder: 'Share your feedback, report an issue, or suggest an improvement',
      successMessageText: 'Thank you for your feedback!',
    }),
  ],
  // Setting this option to true will send default PII data to Sentry.
  // For example, automatic IP address collection on events
  sendDefaultPii: true,
  // Tracing
  tracesSampleRate: 0.1, //  Capture 10% of the transactions
  // Session Replay
  replaysSessionSampleRate: 0.1, // This sets the sample rate at 10%. You may want to change it to 100% while in development and then sample at a lower rate in production.
  replaysOnErrorSampleRate: 1.0, // If you're not already sampling the entire session, change the sample rate to 100% when sampling sessions where errors occur.,
  // Enable logs to be sent to Sentry
  enableLogs: true,
});

export const setUser = Sentry.setUser;
export const feedback = Sentry.getFeedback();
