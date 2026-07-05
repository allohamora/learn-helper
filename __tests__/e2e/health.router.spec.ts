import { describe, expect, it } from 'vitest';
import { client } from '../setup-e2e-context';
import { auth } from '../mocks/auth.middleware.mock';

describe('health.router', () => {
  describe('GET /api/v1/health', () => {
    it('returns 200 OK', async () => {
      const res = await client.api.v1.health.$get();
      expect(res.status).toBe(200);
    });

    it('returns 401 Unauthorized when not authenticated', async () => {
      auth.unauthorized();

      const res = await client.api.v1.health.$get();
      expect(res.status).toBe(401);
    });
  });
});
