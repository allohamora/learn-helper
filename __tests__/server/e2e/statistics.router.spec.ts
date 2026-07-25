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

      const res = await client.api.v1.users.me.statistics.$get({ query: {} });

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

      const res = await client.api.v1.users.me.statistics.$get({ query: {} });

      expect(res.status).toBe(401);
    });

    it('returns 400 for an invalid timezone', async () => {
      auth.authorized({ user: { id: USER_ID } });

      const res = await client.api.v1.users.me.statistics.$get({ query: { timezone: 'Mars/Olympus_Mons' } });

      expect(res.status).toBe(400);
    });

    it('returns the same events in different daily buckets for different timezones', async () => {
      auth.authorized({ user: { id: USER_ID } });
      await db.insert(user).values({ id: USER_ID, name: 'Statistics User', email: `${USER_ID}@example.com` });

      // example utc: 22.07.2026, 00:30
      // example new york: 21.07.2026, 20:30
      const previousUtcDay = new Date();
      previousUtcDay.setUTCDate(previousUtcDay.getUTCDate() - 1);
      previousUtcDay.setUTCHours(0, 30, 0, 0);

      // example utc: 22.07.2026, 12:00
      // example new york: 22.07.2026, 08:00
      const previousUtcDayNoon = new Date(previousUtcDay);
      previousUtcDayNoon.setUTCHours(12, 0, 0, 0);

      await db.insert(event).values([
        {
          userId: USER_ID,
          type: EventType.UserVocabularyItemTaskGenerated,
          costInNanoDollars: 1000,
          createdAt: previousUtcDay,
        },
        {
          userId: USER_ID,
          type: EventType.UserVocabularyItemTaskGenerated,
          costInNanoDollars: 2000,
          createdAt: previousUtcDayNoon,
        },
      ]);

      const utcDate = previousUtcDay.toISOString().slice(0, 10);
      const newYorkPreviousDate = new Date(previousUtcDay);
      newYorkPreviousDate.setUTCDate(newYorkPreviousDate.getUTCDate() - 1);
      const newYorkPreviousDateString = newYorkPreviousDate.toISOString().slice(0, 10);

      const utcRes = await client.api.v1.users.me.statistics.$get({ query: { timezone: 'UTC' } });
      const newYorkRes = await client.api.v1.users.me.statistics.$get({
        query: { timezone: 'America/New_York' },
      });

      expect(utcRes.status).toBe(200);
      expect(newYorkRes.status).toBe(200);
      const utc = await utcRes.json();
      const newYork = await newYorkRes.json();

      if (!utc.success || !newYork.success) throw new Error('expected successful statistics responses');

      expect(utc.data.costPerDay).toEqual(
        expect.arrayContaining([
          // first event in example utc: 22.07.2026, 00:30 with 1000
          // second event in example utc: 22.07.2026, 12:00 with 2000
          expect.objectContaining({ date: utcDate, costInNanoDollars: 3000 }),
        ]),
      );
      expect(newYork.data.costPerDay).toEqual(
        expect.arrayContaining([
          // first event in example new york: 21.07.2026, 20:30 with 1000
          expect.objectContaining({ date: newYorkPreviousDateString, costInNanoDollars: 1000 }),
          // second event in example new york: 22.07.2026, 08:00 with 2000
          expect.objectContaining({ date: utcDate, costInNanoDollars: 2000 }),
        ]),
      );
    });
  });
});
