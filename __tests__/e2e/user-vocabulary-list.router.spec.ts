import { describe, expect, it } from 'vitest';
import { eq } from 'drizzle-orm';
import { client } from '../setup-e2e-context';
import { auth } from '../mocks/auth.middleware.mock';
import { db } from '@/server/db/db.service';
import { user, userVocabularyItem } from '@/server/db/db.schema';
import { countItems } from '@/server/db/db.utils';
import { createMissingVocabularyItems } from '@/server/vocabulary/vocabulary-item.repository';
import { createVocabularyListItemsIfNotExist } from '@/server/vocabulary/vocabulary-list-item.repository';
import { findOrCreateVocabularyListByTitle } from '@/server/vocabulary/vocabulary-list.repository';
import { LearningStatus, PartOfSpeech } from '@/const/vocabulary';

const USER_ID = 'e2e-test-user';

const seedList = async (values: string[] = ['run']) => {
  const list = await findOrCreateVocabularyListByTitle('Oxford 5000 A1');
  const items = await createMissingVocabularyItems(
    values.map((value) => ({
      value,
      definition: `definition of ${value}`,
      uaTranslation: value,
      partOfSpeech: PartOfSpeech.Verb,
      spelling: value,
    })),
  );
  await createVocabularyListItemsIfNotExist(
    items.map((item) => ({ vocabularyListId: list.id, vocabularyItemId: item.id })),
  );

  return { list, items };
};

describe('user-vocabulary-list.router', () => {
  describe('GET /api/v1/users/me/vocabulary-lists/available', () => {
    it('returns 200 with lists', async () => {
      auth.authorized();
      await seedList();

      const res = await client.api.v1.users.me['vocabulary-lists'].available.$get();
      expect(res.status).toBe(200);

      const body = await res.json();
      expect(body).toMatchObject({
        success: true,
        data: [{ title: 'Oxford 5000 A1', addedAt: null }],
      });
    });

    it('returns 401 Unauthorized when not authenticated', async () => {
      auth.unauthorized();

      const res = await client.api.v1.users.me['vocabulary-lists'].available.$get();
      expect(res.status).toBe(401);
    });

    it('marks an enrolled list as added and sorts it first', async () => {
      auth.authorized({ user: { id: USER_ID } });
      await db.insert(user).values({ id: USER_ID, name: 'E2E User', email: `${USER_ID}@example.com` });
      const { list } = await seedList();
      await findOrCreateVocabularyListByTitle('Oxford 5000 A2');

      const postRes = await client.api.v1.users.me['vocabulary-lists'].$post({ json: { id: list.id } });
      expect(postRes.status).toBe(200);

      const res = await client.api.v1.users.me['vocabulary-lists'].available.$get();

      const body = await res.json();
      expect(body).toMatchObject({
        success: true,
        data: [{ title: 'Oxford 5000 A1', addedAt: expect.any(String) }, { addedAt: null }],
      });
    });
  });

  describe('POST /api/v1/users/me/vocabulary-lists', () => {
    it('returns 200 and enqueues the list for the authenticated user', async () => {
      auth.authorized({ user: { id: USER_ID } });
      await db.insert(user).values({ id: USER_ID, name: 'E2E User', email: `${USER_ID}@example.com` });
      const { list } = await seedList();

      const res = await client.api.v1.users.me['vocabulary-lists'].$post({ json: { id: list.id } });
      expect(res.status).toBe(200);

      expect(await countItems(userVocabularyItem)).toBe(1);
    });

    it('returns 401 Unauthorized when not authenticated', async () => {
      auth.unauthorized();
      const { list } = await seedList();

      const res = await client.api.v1.users.me['vocabulary-lists'].$post({ json: { id: list.id } });
      expect(res.status).toBe(401);
    });

    it('returns 404 for a non-existent list', async () => {
      auth.authorized({ user: { id: USER_ID } });
      await db.insert(user).values({ id: USER_ID, name: 'E2E User', email: `${USER_ID}@example.com` });

      const res = await client.api.v1.users.me['vocabulary-lists'].$post({
        json: { id: '00000000-0000-0000-0000-000000000000' },
      });
      expect(res.status).toBe(404);
    });
  });

  describe('GET /api/v1/users/me/vocabulary-lists/:id/items', () => {
    it('returns 200 with the words the user has added to the list', async () => {
      auth.authorized({ user: { id: USER_ID } });
      await db.insert(user).values({ id: USER_ID, name: 'E2E User', email: `${USER_ID}@example.com` });
      const { list } = await seedList(['run']);
      await client.api.v1.users.me['vocabulary-lists'].$post({ json: { id: list.id } });

      const res = await client.api.v1.users.me['vocabulary-lists'][':id'].items.$get({
        param: { id: list.id },
        query: {},
      });
      expect(res.status).toBe(200);

      const body = await res.json();
      expect(body).toMatchObject({
        success: true,
        data: [{ value: 'run', status: LearningStatus.Waiting }],
        pageInfo: { total: 1, count: 1 },
      });
    });

    it('returns 401 Unauthorized when not authenticated', async () => {
      auth.unauthorized();
      const { list } = await seedList();

      const res = await client.api.v1.users.me['vocabulary-lists'][':id'].items.$get({
        param: { id: list.id },
        query: {},
      });
      expect(res.status).toBe(401);
    });

    it('returns 404 when the user has not added the list', async () => {
      auth.authorized({ user: { id: USER_ID } });
      await db.insert(user).values({ id: USER_ID, name: 'E2E User', email: `${USER_ID}@example.com` });
      const { list } = await seedList();

      const res = await client.api.v1.users.me['vocabulary-lists'][':id'].items.$get({
        param: { id: list.id },
        query: {},
      });
      expect(res.status).toBe(404);
    });

    it('paginates items across pages honoring limit and cursor', async () => {
      auth.authorized({ user: { id: USER_ID } });
      await db.insert(user).values({ id: USER_ID, name: 'E2E User', email: `${USER_ID}@example.com` });
      const words = ['run', 'walk', 'jump', 'swim', 'fly'];
      const { list } = await seedList(words);
      await client.api.v1.users.me['vocabulary-lists'].$post({ json: { id: list.id } });

      const firstRes = await client.api.v1.users.me['vocabulary-lists'][':id'].items.$get({
        param: { id: list.id },
        query: { limit: '2' },
      });
      expect(firstRes.status).toBe(200);
      const firstBody = await firstRes.json();
      expect(firstBody.data).toHaveLength(2);
      expect(firstBody.pageInfo).toMatchObject({ total: 5, count: 2 });
      expect(firstBody.pageInfo.nextCursor).toEqual(expect.any(String));

      const secondRes = await client.api.v1.users.me['vocabulary-lists'][':id'].items.$get({
        param: { id: list.id },
        query: { limit: '2', cursor: firstBody.pageInfo.nextCursor },
      });
      expect(secondRes.status).toBe(200);
      const secondBody = await secondRes.json();
      expect(secondBody.data).toHaveLength(2);
      expect(secondBody.pageInfo).toMatchObject({ total: 5, count: 2 });
      expect(secondBody.pageInfo.nextCursor).toEqual(expect.any(String));

      const thirdRes = await client.api.v1.users.me['vocabulary-lists'][':id'].items.$get({
        param: { id: list.id },
        query: { limit: '2', cursor: secondBody.pageInfo.nextCursor },
      });
      expect(thirdRes.status).toBe(200);
      const thirdBody = await thirdRes.json();
      expect(thirdBody.data).toHaveLength(1);
      expect(thirdBody.pageInfo).toMatchObject({ total: 5, count: 1 });
      expect(thirdBody.pageInfo.nextCursor).toBeUndefined();

      // pages must be disjoint (no item repeated across pages) and together cover every word exactly once
      const pagedValues = [...firstBody.data, ...secondBody.data, ...thirdBody.data].map((item) => item.value);
      expect(pagedValues).toEqual(words);
    });

    it('returns every item in the list exactly once when following nextCursor to the end', async () => {
      auth.authorized({ user: { id: USER_ID } });
      await db.insert(user).values({ id: USER_ID, name: 'E2E User', email: `${USER_ID}@example.com` });
      const words = ['run', 'walk', 'jump', 'swim', 'fly', 'read', 'write'];
      const { list } = await seedList(words);
      await client.api.v1.users.me['vocabulary-lists'].$post({ json: { id: list.id } });

      const collected: string[] = [];
      let cursor: string | undefined;

      do {
        const res = await client.api.v1.users.me['vocabulary-lists'][':id'].items.$get({
          param: { id: list.id },
          query: { limit: '3', ...(cursor ? { cursor } : {}) },
        });
        expect(res.status).toBe(200);

        const body = await res.json();
        expect(body.pageInfo.total).toBe(words.length);
        collected.push(...body.data.map((item) => item.value));
        cursor = body.pageInfo.nextCursor;
      } while (cursor);

      expect(collected).toEqual(words);
      expect(new Set(collected).size).toBe(words.length);
    });
  });

  describe('GET /api/v1/users/me/vocabulary-lists/:id/progress', () => {
    it('returns 200 with the title and all items waiting right after adding a list', async () => {
      auth.authorized({ user: { id: USER_ID } });
      await db.insert(user).values({ id: USER_ID, name: 'E2E User', email: `${USER_ID}@example.com` });
      const words = ['run', 'walk', 'jump'];
      const { list } = await seedList(words);
      await client.api.v1.users.me['vocabulary-lists'].$post({ json: { id: list.id } });

      const res = await client.api.v1.users.me['vocabulary-lists'][':id'].progress.$get({ param: { id: list.id } });
      expect(res.status).toBe(200);

      const body = await res.json();
      expect(body).toMatchObject({
        success: true,
        data: { title: 'Oxford 5000 A1', total: 3, waiting: 3, learning: 0, learned: 0, known: 0 },
      });
    });

    it('returns 200 with counts split across statuses', async () => {
      auth.authorized({ user: { id: USER_ID } });
      await db.insert(user).values({ id: USER_ID, name: 'E2E User', email: `${USER_ID}@example.com` });
      const words = ['run', 'walk', 'jump', 'swim'];
      const { list, items } = await seedList(words);
      await client.api.v1.users.me['vocabulary-lists'].$post({ json: { id: list.id } });

      const [, walk, jump, swim] = items;
      await db
        .update(userVocabularyItem)
        .set({ status: LearningStatus.Learning })
        .where(eq(userVocabularyItem.vocabularyItemId, walk.id));
      await db
        .update(userVocabularyItem)
        .set({ status: LearningStatus.Learned })
        .where(eq(userVocabularyItem.vocabularyItemId, jump.id));
      await db
        .update(userVocabularyItem)
        .set({ status: LearningStatus.Known })
        .where(eq(userVocabularyItem.vocabularyItemId, swim.id));

      const res = await client.api.v1.users.me['vocabulary-lists'][':id'].progress.$get({ param: { id: list.id } });
      expect(res.status).toBe(200);

      const body = await res.json();
      expect(body).toMatchObject({
        success: true,
        data: { title: 'Oxford 5000 A1', total: 4, waiting: 1, learning: 1, learned: 1, known: 1 },
      });
    });

    it('returns 401 Unauthorized when not authenticated', async () => {
      auth.unauthorized();
      const { list } = await seedList();

      const res = await client.api.v1.users.me['vocabulary-lists'][':id'].progress.$get({ param: { id: list.id } });
      expect(res.status).toBe(401);
    });

    it('returns 404 when the user has not added the list', async () => {
      auth.authorized({ user: { id: USER_ID } });
      await db.insert(user).values({ id: USER_ID, name: 'E2E User', email: `${USER_ID}@example.com` });
      const { list } = await seedList();

      const res = await client.api.v1.users.me['vocabulary-lists'][':id'].progress.$get({ param: { id: list.id } });
      expect(res.status).toBe(404);
    });
  });
});
