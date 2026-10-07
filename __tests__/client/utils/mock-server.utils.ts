import type { RequestHandler } from 'msw';
import { HttpNetworkFrame } from 'msw/experimental';
import { setupServer } from 'msw/node';
import { vitest } from 'vitest';

export const createMockServer = () => {
  const server = setupServer();
  const onUnhandledRequest = vitest.fn();

  return {
    onUnhandledRequest,
    start() {
      server.listen({
        onUnhandledFrame({ frame, defaults }) {
          if (frame instanceof HttpNetworkFrame) {
            const { request } = frame.data;

            console.error(`[MSW] Request not in whitelist: ${request.method} ${request.url}`);
          }

          onUnhandledRequest();

          defaults.error();
        },
      });
    },
    addHandlers(...handlers: RequestHandler[]) {
      server.use(...handlers);
    },
    clearHandlers() {
      server.resetHandlers();
    },
    stop() {
      server.close();
    },
  };
};

export type MockServer = ReturnType<typeof createMockServer>;
