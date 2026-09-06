import '@tanstack/react-start/server-only';
import { createMiddleware } from 'hono/factory';
import { routePath } from 'hono/route';
import type { ServerEntry } from '@tanstack/react-start/server-entry';
import { getActiveSpan, getRootSpan, metrics, spanToJSON } from '../instrument';

type HttpMetricAttributes = {
  'http.request.method': string;
  'http.route': string;
  'http.response.status_code': number;
};

const recordHttpRequestMetrics = (attributes: HttpMetricAttributes, durationMs: number) => {
  metrics.count('http.server.request.count', 1, { attributes });
  metrics.distribution('http.server.request.duration', durationMs, { unit: 'millisecond', attributes });
};

// Hono's own OTel span naming only lands on its per-handler child span, not as an inheritable
// http.route attribute on the root span, so API route metrics are collected here rather than
// via withRequestMetrics below. routePath(c) resolves to '*' inside a wildcard `.use('*', ...)`
// middleware while routing is unresolved; index -1 must be read after `await next()`.
export const httpMetricsMiddleware = createMiddleware(async (c, next) => {
  const start = performance.now();

  await next();

  recordHttpRequestMetrics(
    {
      'http.request.method': c.req.method,
      'http.route': routePath(c, -1),
      'http.response.status_code': c.res.status,
    },
    performance.now() - start,
  );
});

const getHttpRoute = (pathname: string) => {
  const activeSpan = getActiveSpan();

  if (!activeSpan) {
    return pathname;
  }

  const route = spanToJSON(getRootSpan(activeSpan)).data['http.route'];

  return typeof route === 'string' ? route : pathname;
};

// Covers everything except /api/*, which httpMetricsMiddleware above handles; must run inside
// wrapFetchWithSentry (composed as its argument) so the Sentry root span already exists by the
// time getActiveSpan() is called.
export const withRequestMetrics = (serverEntry: ServerEntry): ServerEntry => ({
  fetch: async (...args: Parameters<ServerEntry['fetch']>) => {
    const [request] = args;
    const url = new URL(request.url);

    if (url.pathname === '/api' || url.pathname.startsWith('/api/')) {
      return serverEntry.fetch(...args);
    }

    const start = performance.now();
    const response = await serverEntry.fetch(...args);

    recordHttpRequestMetrics(
      {
        'http.request.method': request.method,
        'http.route': getHttpRoute(url.pathname),
        'http.response.status_code': response.status,
      },
      performance.now() - start,
    );

    return response;
  },
});
