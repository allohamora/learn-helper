import { describe, it, expect, vitest, beforeEach } from 'vitest';
import { Hono } from 'hono';
import type { ServerEntry } from '@tanstack/react-start/server-entry';

const metricsCount = vitest.fn();
const metricsDistribution = vitest.fn();
const getActiveSpan = vitest.fn();
const getRootSpan = vitest.fn();
const spanToJSON = vitest.fn();

vitest.mock('@/server/instrument', () => ({
  metrics: { count: metricsCount, distribution: metricsDistribution },
  getActiveSpan,
  getRootSpan,
  spanToJSON,
}));

const { httpMetricsMiddleware, withRequestMetrics } = await import('@/server/utils/http-metrics.utils');

beforeEach(() => {
  metricsCount.mockClear();
  metricsDistribution.mockClear();
  getActiveSpan.mockReset();
  getRootSpan.mockReset();
  spanToJSON.mockReset();
});

describe('httpMetricsMiddleware', () => {
  it('records count and distribution once per request with the normalized route + real status', async () => {
    const app = new Hono();
    app.use(httpMetricsMiddleware);
    app.get('/foo/:id', (c) => c.text('ok'));

    const res = await app.request('/foo/123');

    expect(res.status).toBe(200);
    expect(metricsCount).toHaveBeenCalledTimes(1);
    expect(metricsDistribution).toHaveBeenCalledTimes(1);

    const attributes = {
      'http.request.method': 'GET',
      'http.route': '/foo/:id',
      'http.response.status_code': 200,
    };
    expect(metricsCount).toHaveBeenCalledWith('http.server.request.count', 1, { attributes });
    expect(metricsDistribution).toHaveBeenCalledWith('http.server.request.duration', expect.any(Number), {
      unit: 'millisecond',
      attributes,
    });
  });

  it('reflects the real response status code, not a hardcoded one', async () => {
    const app = new Hono();
    app.use(httpMetricsMiddleware);
    app.get('/bar', (c) => c.json({ error: true }, 400));

    await app.request('/bar');

    expect(metricsCount).toHaveBeenCalledWith('http.server.request.count', 1, {
      attributes: expect.objectContaining({ 'http.response.status_code': 400 }),
    });
  });

  it('resolves the fully-qualified route through a nested .route() mount', async () => {
    const nested = new Hono().get('/:id', (c) => c.text('ok'));
    const app = new Hono();
    app.use(httpMetricsMiddleware);
    app.route('/nested', nested);

    await app.request('/nested/123');

    expect(metricsCount).toHaveBeenCalledWith('http.server.request.count', 1, {
      attributes: expect.objectContaining({ 'http.route': '/nested/:id' }),
    });
  });

  it('resolves the /api-prefixed route when mounted like the real api.ts app (.basePath("/api"))', async () => {
    const app = new Hono().basePath('/api');
    app.use(httpMetricsMiddleware);
    app.get('/v1/foo/:id', (c) => c.text('ok'));

    const res = await app.request('/api/v1/foo/123');

    expect(res.status).toBe(200);
    expect(metricsCount).toHaveBeenCalledWith('http.server.request.count', 1, {
      attributes: {
        'http.request.method': 'GET',
        'http.route': '/api/v1/foo/:id',
        'http.response.status_code': 200,
      },
    });
  });
});

describe('withRequestMetrics', () => {
  const buildServerEntry = (response: Response): ServerEntry => ({
    fetch: vitest.fn().mockResolvedValue(response),
  });

  it('passes /api/* requests through untouched, without recording anything', async () => {
    const inner = buildServerEntry(new Response('ok'));
    const wrapped = withRequestMetrics(inner);

    const res = await wrapped.fetch(new Request('https://example.com/api/v1/foo'));

    expect(res.status).toBe(200);
    expect(inner.fetch).toHaveBeenCalledTimes(1);
    expect(metricsCount).not.toHaveBeenCalled();
    expect(metricsDistribution).not.toHaveBeenCalled();
  });

  it('passes local /api/* requests through untouched as well', async () => {
    const inner = buildServerEntry(new Response('ok'));
    const wrapped = withRequestMetrics(inner);

    const res = await wrapped.fetch(new Request('http://localhost:3000/api/v1/foo'));

    expect(res.status).toBe(200);
    expect(inner.fetch).toHaveBeenCalledTimes(1);
    expect(metricsCount).not.toHaveBeenCalled();
    expect(metricsDistribution).not.toHaveBeenCalled();
  });

  it('records metrics for the root path "/"', async () => {
    getActiveSpan.mockReturnValue({});
    getRootSpan.mockImplementation((span) => span);
    spanToJSON.mockReturnValue({ data: { 'http.route': '/' } });

    const inner = buildServerEntry(new Response('ok', { status: 200 }));
    const wrapped = withRequestMetrics(inner);

    await wrapped.fetch(new Request('http://localhost:3000/'));

    expect(inner.fetch).toHaveBeenCalledTimes(1);
    expect(metricsCount).toHaveBeenCalledWith('http.server.request.count', 1, {
      attributes: {
        'http.request.method': 'GET',
        'http.route': '/',
        'http.response.status_code': 200,
      },
    });
  });

  it('records metrics for non-/api requests using the root span http.route attribute', async () => {
    getActiveSpan.mockReturnValue({});
    getRootSpan.mockImplementation((span) => span);
    spanToJSON.mockReturnValue({ data: { 'http.route': '/vocabulary-lists/$id' } });

    const inner = buildServerEntry(new Response('ok', { status: 200 }));
    const wrapped = withRequestMetrics(inner);

    await wrapped.fetch(new Request('https://example.com/vocabulary-lists/123'));

    expect(metricsCount).toHaveBeenCalledWith('http.server.request.count', 1, {
      attributes: {
        'http.request.method': 'GET',
        'http.route': '/vocabulary-lists/$id',
        'http.response.status_code': 200,
      },
    });
  });

  it('falls back to the raw pathname when there is no active span', async () => {
    getActiveSpan.mockReturnValue(undefined);

    const inner = buildServerEntry(new Response('ok'));
    const wrapped = withRequestMetrics(inner);

    await wrapped.fetch(new Request('https://example.com/vocabulary-lists/123'));

    expect(metricsCount).toHaveBeenCalledWith('http.server.request.count', 1, {
      attributes: expect.objectContaining({ 'http.route': '/vocabulary-lists/123' }),
    });
  });

  it('falls back to the raw pathname when the root span has no http.route attribute', async () => {
    getActiveSpan.mockReturnValue({});
    getRootSpan.mockImplementation((span) => span);
    spanToJSON.mockReturnValue({ data: {} });

    const inner = buildServerEntry(new Response('ok'));
    const wrapped = withRequestMetrics(inner);

    await wrapped.fetch(new Request('https://example.com/vocabulary-lists/123'));

    expect(metricsCount).toHaveBeenCalledWith('http.server.request.count', 1, {
      attributes: expect.objectContaining({ 'http.route': '/vocabulary-lists/123' }),
    });
  });
});
