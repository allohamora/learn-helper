import '@/instrument';
import { StrictMode, startTransition } from 'react';
import * as Sentry from '@sentry/tanstackstart-react';
import { StartClient } from '@tanstack/react-start/client';
import { hydrateRoot } from 'react-dom/client';
import { IS_DEV } from './config';

startTransition(() => {
  hydrateRoot(
    document,
    <StrictMode>
      <StartClient />
    </StrictMode>,
    {
      onUncaughtError: IS_DEV ? console.error : Sentry.reactErrorHandler(),
      onRecoverableError: IS_DEV ? console.error : Sentry.reactErrorHandler(),
      // no Sentry.reactErrorHandler() in production here: it fires for every error our own <Sentry.ErrorBoundary>
      // already reports via componentDidCatch, and Sentry's dedupe integration isn't reliable here since
      // captureReactException mutates the shared error's `.cause` chain on each call, so the two events
      // aren't guaranteed identical. React's default onCaughtError also console.errors the same error, which
      // captureConsoleIntegration turns into a third report, so suppress that default logging too.
      onCaughtError: IS_DEV ? console.error : () => {},
    },
  );
});
