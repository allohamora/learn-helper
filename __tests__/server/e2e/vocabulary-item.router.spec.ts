import * as vocabularyItemGenerationService from '@/server/vocabulary/vocabulary-item-generation.service';
import { afterEach, beforeEach, describe, expect, it, vi, type MockInstance } from 'vitest';
import { eq } from 'drizzle-orm';
import { client } from '../setup-e2e-context';
import { auth } from '../mocks/auth.middleware.mock';
import { db } from '@/server/db/db.service';
import { event, user } from '@/server/db/db.schema';
import { PartOfSpeech } from '@/const/vocabulary';
import { EventType } from '@/const/event';
import type { ErrorResponse } from '@/server/utils/response.utils';

describe('vocabulary-item.router', () => {
  describe('POST /api/v1/vocabulary-items/generate', () => {
    const USER_ID = 'vocabulary-item-generate-user';
    let generateSpy: MockInstance<typeof vocabularyItemGenerationService.generateVocabularyItemData>;

    beforeEach(() => {
      generateSpy = vi
        .spyOn(vocabularyItemGenerationService, 'generateVocabularyItemData')
        .mockImplementation(async ({ value }) => ({
          output: {
            value,
            definition: `definition of ${value}`,
            uaTranslation: `переклад ${value}`,
            partOfSpeech: PartOfSpeech.Noun,
            spelling: `/${value}/`,
          },
          cost: { costInNanoDollars: 1_000_000, inputTokens: 100, outputTokens: 200 },
        }));
    });

    afterEach(() => {
      generateSpy.mockRestore();
    });

    it('returns 200 with the generated vocabulary item data and records a generation event', async () => {
      auth.authorized({ user: { id: USER_ID } });
      await db.insert(user).values({ id: USER_ID, name: 'E2E User', email: `${USER_ID}@example.com` });

      const res = await client.api.v1['vocabulary-items'].generate.$post({
        json: { value: 'run', context: 'a jog' },
      });
      expect(res.status).toBe(200);

      const body = await res.json();
      expect(body).toMatchObject({
        success: true,
        data: {
          value: 'run',
          definition: 'definition of run',
          uaTranslation: 'переклад run',
          partOfSpeech: PartOfSpeech.Noun,
          spelling: '/run/',
        },
      });
      expect(generateSpy).toHaveBeenCalledWith({ value: 'run', context: 'a jog' });

      const events = await db.query.event.findMany({ where: eq(event.userId, USER_ID) });
      expect(events).toEqual([
        expect.objectContaining({
          type: EventType.VocabularyItemGenerated,
          costInNanoDollars: 1_000_000,
          inputTokens: 100,
          outputTokens: 200,
        }),
      ]);
    });

    it('returns 200 without context', async () => {
      auth.authorized({ user: { id: USER_ID } });
      await db.insert(user).values({ id: USER_ID, name: 'E2E User', email: `${USER_ID}@example.com` });

      const res = await client.api.v1['vocabulary-items'].generate.$post({ json: { value: 'run' } });
      expect(res.status).toBe(200);
      expect(generateSpy).toHaveBeenCalledWith({ value: 'run' });
    });

    it('returns 400 when value is missing', async () => {
      auth.authorized();

      const res = await client.api.v1['vocabulary-items'].generate.$post({ json: {} as never });
      expect(res.status).toBe(400);
    });

    it('returns 400 when value is empty', async () => {
      auth.authorized();

      const res = await client.api.v1['vocabulary-items'].generate.$post({ json: { value: '' } });
      expect(res.status).toBe(400);
    });

    it('returns 401 Unauthorized when not authenticated', async () => {
      auth.unauthorized();

      const res = await client.api.v1['vocabulary-items'].generate.$post({ json: { value: 'run' } });
      expect(res.status).toBe(401);
    });

    it('returns 429 Too Many Requests after 20 requests within the rate-limit window', async () => {
      const rateLimitedUserId = 'user-generate-rate-limit';
      auth.authorized({ user: { id: rateLimitedUserId } });
      await db
        .insert(user)
        .values({ id: rateLimitedUserId, name: 'E2E User', email: `${rateLimitedUserId}@example.com` });

      for (let i = 0; i < 20; i++) {
        const res = await client.api.v1['vocabulary-items'].generate.$post({ json: { value: 'run' } });
        expect(res.status).toBe(200);
      }

      const res = await client.api.v1['vocabulary-items'].generate.$post({ json: { value: 'run' } });
      expect(res.status).toBe(429);

      const body = (await res.json()) as unknown as ErrorResponse;
      expect(body.error.code).toBe('TOO_MANY_REQUESTS');
    });
  });
});
