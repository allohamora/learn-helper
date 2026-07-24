import { describe, expect, it } from 'vitest';
import { EventType } from '@/const/event';
import { db } from '@/server/db/db.service';
import { event, user } from '@/server/db/db.schema';
import { client } from '../setup-e2e-context';
import { auth } from '../mocks/auth.middleware.mock';

const USER_ID = 'statistics-e2e-user';

describe('statistics.router', () => {
  describe('GET /api/v1/users/me/statistics', () => {
    it('returns the authenticated user statistics', async () => {
      auth.authorized({ user: { id: USER_ID } });
      await db.insert(user).values({ id: USER_ID, name: 'Statistics User', email: `${USER_ID}@example.com` });
      await db.insert(event).values({
        userId: USER_ID,
        type: EventType.UserVocabularyItemTaskGenerated,
        costInNanoDollars: 1234,
        inputTokens: 10,
        outputTokens: 20,
      });

      const res = await client.api.v1.users.me.statistics.$get();

      expect(res.status).toBe(200);
      expect(await res.json()).toMatchObject({
        success: true,
        data: {
          general: {
            totalTaskCostsInNanoDollars: 1234,
            totalInputTokens: 10,
            totalOutputTokens: 20,
          },
          discoveringPerDay: expect.arrayContaining([expect.objectContaining({ date: expect.any(String) })]),
        },
      });
    });

    it('returns 401 when unauthenticated', async () => {
      auth.unauthorized();

      const res = await client.api.v1.users.me.statistics.$get();

      expect(res.status).toBe(401);
    });
  });
});
