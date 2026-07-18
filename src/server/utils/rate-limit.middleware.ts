import '@tanstack/react-start/server-only';
import { createMiddleware } from 'hono/factory';
import { RateLimiterMemory } from 'rate-limiter-flexible';
import { Exception } from './exception.utils';

export const rateLimit = ({ count, durationSec }: { count: number; durationSec: number }) => {
  const limiter = new RateLimiterMemory({ points: count, duration: durationSec });

  return createMiddleware<{
    Variables: {
      user: { id: string };
    };
  }>(async (c, next) => {
    const user = c.get('user');

    try {
      await limiter.consume(user.id);
    } catch {
      throw Exception.tooManyRequests();
    }

    await next();
  });
};
