import { describe, it, expect } from 'vitest';
import { Hono } from 'hono';
import { rateLimit } from '@/server/auth/rate-limit.middleware';
import { Exception } from '@/server/utils/exception.utils';

type Variables = { user: { id: string } };

const buildApp = (options: { count: number; durationSec: number }) => {
  const app = new Hono<{ Variables: Variables }>();

  app.onError((err, c) => {
    if (err instanceof Exception) {
      return c.json(...err.toHttpResponse());
    }

    throw err;
  });

  app.use(async (c, next) => {
    c.set('user', { id: c.req.query('userId')! });

    await next();
  });

  app.get('/', rateLimit(options), (c) => c.text('ok'));

  return app;
};

describe('rate-limit.middleware', () => {
  it('allows up to `count` requests per key within the window', async () => {
    const app = buildApp({ count: 2, durationSec: 60 });

    const res1 = await app.request('/?userId=user-1');
    const res2 = await app.request('/?userId=user-1');

    expect(res1.status).toBe(200);
    expect(res2.status).toBe(200);
  });

  it('throws a TOO_MANY_REQUESTS exception once `count` is exceeded', async () => {
    const app = buildApp({ count: 1, durationSec: 60 });

    const res1 = await app.request('/?userId=user-1');
    const res2 = await app.request('/?userId=user-1');

    expect(res1.status).toBe(200);
    expect(res2.status).toBe(429);
    expect((await res2.json()).error.code).toBe('TOO_MANY_REQUESTS');
  });

  it('tracks separate counters per user id', async () => {
    const app = buildApp({ count: 1, durationSec: 60 });

    const res1 = await app.request('/?userId=user-1');
    const res2 = await app.request('/?userId=user-2');

    expect(res1.status).toBe(200);
    expect(res2.status).toBe(200);
  });
});
