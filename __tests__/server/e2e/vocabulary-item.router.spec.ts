import * as vocabularyItemGenerationService from '@/server/vocabulary/vocabulary-item-generation.service';
import { afterEach, beforeEach, describe, expect, it, vi, type MockInstance } from 'vitest';
import { client } from '../setup-e2e-context';
import { auth } from '../mocks/auth.middleware.mock';
import { db } from '@/server/db/db.service';
import { user } from '@/server/db/db.schema';
import { createMissingVocabularyItems } from '@/server/vocabulary/vocabulary-item.repository';
import { PartOfSpeech } from '@/const/vocabulary';
import { RequestType } from '@/const/request';
import type { ErrorResponse } from '@/server/utils/response.utils';

const seedItems = async (values: string[]) =>
  createMissingVocabularyItems(
    values.map((value) => ({
      value,
      definition: `definition of ${value}`,
      uaTranslation: value,
      partOfSpeech: PartOfSpeech.Verb,
      spelling: value,
    })),
  );

describe('vocabulary-item.router', () => {
  describe('GET /api/v1/vocabulary-items', () => {
    it('returns 200 with items matching value case-insensitively', async () => {
      auth.authorized();
      await seedItems(['Run', 'running', 'jump']);

      const res = await client.api.v1['vocabulary-items'].$get({ query: { value: 'run' } });
      expect(res.status).toBe(200);

      const body = await res.json();
      expect(body).toMatchObject({
        success: true,
        data: [{ value: 'Run' }, { value: 'running' }],
        pageInfo: { total: 2, count: 2 },
      });
    });

    it('returns an empty array with total 0 when nothing matches', async () => {
      auth.authorized();
      await seedItems(['run']);

      const res = await client.api.v1['vocabulary-items'].$get({ query: { value: 'xyz' } });
      expect(res.status).toBe(200);

      const body = await res.json();
      expect(body).toMatchObject({ success: true, data: [], pageInfo: { total: 0, count: 0 } });
    });

    it('paginates items across pages honoring limit and cursor', async () => {
      auth.authorized();
      const itemValues = ['run1', 'run2', 'run3', 'run4', 'run5'];
      await seedItems(itemValues);

      const firstRes = await client.api.v1['vocabulary-items'].$get({ query: { value: 'run', limit: '2' } });
      expect(firstRes.status).toBe(200);
      const firstBody = await firstRes.json();
      expect(firstBody.data).toHaveLength(2);
      expect(firstBody.pageInfo).toMatchObject({ total: 5, count: 2 });
      expect(firstBody.pageInfo.nextCursor).toEqual(expect.any(String));

      const secondRes = await client.api.v1['vocabulary-items'].$get({
        query: { value: 'run', limit: '2', cursor: firstBody.pageInfo.nextCursor },
      });
      expect(secondRes.status).toBe(200);
      const secondBody = await secondRes.json();
      expect(secondBody.data).toHaveLength(2);
      expect(secondBody.pageInfo).toMatchObject({ total: 5, count: 2 });
      expect(secondBody.pageInfo.nextCursor).toEqual(expect.any(String));

      const thirdRes = await client.api.v1['vocabulary-items'].$get({
        query: { value: 'run', limit: '2', cursor: secondBody.pageInfo.nextCursor },
      });
      expect(thirdRes.status).toBe(200);
      const thirdBody = await thirdRes.json();
      expect(thirdBody.data).toHaveLength(1);
      expect(thirdBody.pageInfo).toMatchObject({ total: 5, count: 1 });
      expect(thirdBody.pageInfo.nextCursor).toBeUndefined();

      const pagedValues = [...firstBody.data, ...secondBody.data, ...thirdBody.data].map((item) => item.value);
      expect(new Set(pagedValues)).toEqual(new Set(itemValues));
      expect(pagedValues).toHaveLength(itemValues.length);
    });

    it('rejects a limit above 50', async () => {
      auth.authorized();

      const res = await client.api.v1['vocabulary-items'].$get({ query: { value: 'run', limit: '999' } });
      expect(res.status).toBe(400);
    });

    it('skips the total count and returns total: 0 when type is data', async () => {
      auth.authorized();
      await seedItems(['run']);

      const res = await client.api.v1['vocabulary-items'].$get({ query: { value: 'run', type: RequestType.Data } });
      expect(res.status).toBe(200);

      const body = await res.json();
      expect(body.data).toHaveLength(1);
      expect(body.pageInfo.total).toBe(0);
    });

    it('returns 400 when value is missing', async () => {
      auth.authorized();

      const res = await client.api.v1['vocabulary-items'].$get({ query: {} as never });
      expect(res.status).toBe(400);
    });

    it('returns 401 Unauthorized when not authenticated', async () => {
      auth.unauthorized();

      const res = await client.api.v1['vocabulary-items'].$get({ query: { value: 'run' } });
      expect(res.status).toBe(401);
    });
  });

  describe('POST /api/v1/vocabulary-items/generate', () => {
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
          cost: { costInNanoDollars: 0, inputTokens: 0, outputTokens: 0 },
        }));
    });

    afterEach(() => {
      generateSpy.mockRestore();
    });

    it('returns 200 with the generated vocabulary item data', async () => {
      auth.authorized();

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
    });

    it('returns 200 without context', async () => {
      auth.authorized();

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
