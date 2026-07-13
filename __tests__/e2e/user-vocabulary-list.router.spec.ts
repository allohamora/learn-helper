import { describe, expect, it } from 'vitest';
import { and, eq } from 'drizzle-orm';
import { client } from '../setup-e2e-context';
import { auth } from '../mocks/auth.middleware.mock';
import { db } from '@/server/db/db.service';
import { event, user, userVocabularyItem, vocabularyItem } from '@/server/db/db.schema';
import { countItems } from '@/server/db/db.utils';
import { createMissingVocabularyItems } from '@/server/vocabulary/vocabulary-item.repository';
import { createVocabularyListItemsIfNotExist } from '@/server/vocabulary/vocabulary-list-item.repository';
import { findOrCreateVocabularyListByTitle } from '@/server/vocabulary/vocabulary-list.repository';
import { EventType } from '@/const/event';
import { LearningStatus, PartOfSpeech } from '@/const/vocabulary';

const USER_ID = 'e2e-test-user';

const seedList = async (values: string[] = ['run'], title = 'Oxford 5000 A1') => {
  const list = await findOrCreateVocabularyListByTitle(title);
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

      const postRes = await client.api.v1.users.me['vocabulary-lists'].$post({ json: { vocabularyListId: list.id } });
      expect(postRes.status).toBe(201);

      const res = await client.api.v1.users.me['vocabulary-lists'].available.$get();

      const body = await res.json();
      expect(body).toMatchObject({
        success: true,
        data: [{ title: 'Oxford 5000 A1', addedAt: expect.any(String) }, { addedAt: null }],
      });
    });
  });

  describe('POST /api/v1/users/me/vocabulary-lists', () => {
    it('returns 201 and enqueues the list for the authenticated user', async () => {
      auth.authorized({ user: { id: USER_ID } });
      await db.insert(user).values({ id: USER_ID, name: 'E2E User', email: `${USER_ID}@example.com` });
      const { list } = await seedList();

      const res = await client.api.v1.users.me['vocabulary-lists'].$post({ json: { vocabularyListId: list.id } });
      expect(res.status).toBe(201);

      expect(await countItems(userVocabularyItem)).toBe(1);
    });

    it('returns 401 Unauthorized when not authenticated', async () => {
      auth.unauthorized();
      const { list } = await seedList();

      const res = await client.api.v1.users.me['vocabulary-lists'].$post({ json: { vocabularyListId: list.id } });
      expect(res.status).toBe(401);
    });

    it('returns 404 for a non-existent list', async () => {
      auth.authorized({ user: { id: USER_ID } });
      await db.insert(user).values({ id: USER_ID, name: 'E2E User', email: `${USER_ID}@example.com` });

      const res = await client.api.v1.users.me['vocabulary-lists'].$post({
        json: { vocabularyListId: '00000000-0000-7000-8000-000000000000' },
      });
      expect(res.status).toBe(404);
    });
  });

  describe('GET /api/v1/users/me/vocabulary-lists/:userVocabularyListId', () => {
    it("returns 200 with the user's list and the vocabulary list it points to", async () => {
      auth.authorized({ user: { id: USER_ID } });
      await db.insert(user).values({ id: USER_ID, name: 'E2E User', email: `${USER_ID}@example.com` });
      const { list } = await seedList();
      const postRes = await client.api.v1.users.me['vocabulary-lists'].$post({ json: { vocabularyListId: list.id } });
      const { data: userList } = await postRes.json();

      const res = await client.api.v1.users.me['vocabulary-lists'][':userVocabularyListId'].$get({
        param: { userVocabularyListId: userList.id },
      });
      expect(res.status).toBe(200);

      const body = await res.json();
      expect(body).toMatchObject({
        success: true,
        data: { id: userList.id, vocabularyListId: list.id, vocabularyList: { id: list.id, title: 'Oxford 5000 A1' } },
      });
    });

    it('returns 401 Unauthorized when not authenticated', async () => {
      auth.unauthorized();
      const { list } = await seedList();

      const res = await client.api.v1.users.me['vocabulary-lists'][':userVocabularyListId'].$get({
        param: { userVocabularyListId: list.id },
      });
      expect(res.status).toBe(401);
    });

    it('returns 404 when the user has not added the list', async () => {
      auth.authorized({ user: { id: USER_ID } });
      await db.insert(user).values({ id: USER_ID, name: 'E2E User', email: `${USER_ID}@example.com` });
      const { list } = await seedList();

      const res = await client.api.v1.users.me['vocabulary-lists'][':userVocabularyListId'].$get({
        param: { userVocabularyListId: list.id },
      });
      expect(res.status).toBe(404);
    });
  });

  describe('GET /api/v1/users/me/vocabulary-lists/:userVocabularyListId/items', () => {
    it('returns 200 with the words the user has added to the list', async () => {
      auth.authorized({ user: { id: USER_ID } });
      await db.insert(user).values({ id: USER_ID, name: 'E2E User', email: `${USER_ID}@example.com` });
      const { list } = await seedList(['run']);
      const postRes = await client.api.v1.users.me['vocabulary-lists'].$post({ json: { vocabularyListId: list.id } });
      const { data: userList } = await postRes.json();

      const res = await client.api.v1.users.me['vocabulary-lists'][':userVocabularyListId'].items.$get({
        param: { userVocabularyListId: userList.id },
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

      const res = await client.api.v1.users.me['vocabulary-lists'][':userVocabularyListId'].items.$get({
        param: { userVocabularyListId: list.id },
        query: {},
      });
      expect(res.status).toBe(401);
    });

    it('returns 404 when the user has not added the list', async () => {
      auth.authorized({ user: { id: USER_ID } });
      await db.insert(user).values({ id: USER_ID, name: 'E2E User', email: `${USER_ID}@example.com` });
      const { list } = await seedList();

      const res = await client.api.v1.users.me['vocabulary-lists'][':userVocabularyListId'].items.$get({
        param: { userVocabularyListId: list.id },
        query: {},
      });
      expect(res.status).toBe(404);
    });

    it('paginates items across pages honoring limit and cursor', async () => {
      auth.authorized({ user: { id: USER_ID } });
      await db.insert(user).values({ id: USER_ID, name: 'E2E User', email: `${USER_ID}@example.com` });
      const words = ['run', 'walk', 'jump', 'swim', 'fly'];
      const { list } = await seedList(words);
      const postRes = await client.api.v1.users.me['vocabulary-lists'].$post({ json: { vocabularyListId: list.id } });
      const { data: userList } = await postRes.json();

      const firstRes = await client.api.v1.users.me['vocabulary-lists'][':userVocabularyListId'].items.$get({
        param: { userVocabularyListId: userList.id },
        query: { limit: '2' },
      });
      expect(firstRes.status).toBe(200);
      const firstBody = await firstRes.json();
      expect(firstBody.data).toHaveLength(2);
      expect(firstBody.pageInfo).toMatchObject({ total: 5, count: 2 });
      expect(firstBody.pageInfo.nextCursor).toEqual(expect.any(String));

      const secondRes = await client.api.v1.users.me['vocabulary-lists'][':userVocabularyListId'].items.$get({
        param: { userVocabularyListId: userList.id },
        query: { limit: '2', cursor: firstBody.pageInfo.nextCursor },
      });
      expect(secondRes.status).toBe(200);
      const secondBody = await secondRes.json();
      expect(secondBody.data).toHaveLength(2);
      expect(secondBody.pageInfo).toMatchObject({ total: 5, count: 2 });
      expect(secondBody.pageInfo.nextCursor).toEqual(expect.any(String));

      const thirdRes = await client.api.v1.users.me['vocabulary-lists'][':userVocabularyListId'].items.$get({
        param: { userVocabularyListId: userList.id },
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
      const postRes = await client.api.v1.users.me['vocabulary-lists'].$post({ json: { vocabularyListId: list.id } });
      const { data: userList } = await postRes.json();

      const collected: string[] = [];
      let cursor: string | undefined;

      do {
        const res = await client.api.v1.users.me['vocabulary-lists'][':userVocabularyListId'].items.$get({
          param: { userVocabularyListId: userList.id },
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

  describe('GET /api/v1/users/me/vocabulary-lists/:userVocabularyListId/progress', () => {
    it('returns 200 with all items waiting right after adding a list', async () => {
      auth.authorized({ user: { id: USER_ID } });
      await db.insert(user).values({ id: USER_ID, name: 'E2E User', email: `${USER_ID}@example.com` });
      const words = ['run', 'walk', 'jump'];
      const { list } = await seedList(words);
      const postRes = await client.api.v1.users.me['vocabulary-lists'].$post({ json: { vocabularyListId: list.id } });
      const { data: userList } = await postRes.json();

      const res = await client.api.v1.users.me['vocabulary-lists'][':userVocabularyListId'].progress.$get({
        param: { userVocabularyListId: userList.id },
      });
      expect(res.status).toBe(200);

      const body = await res.json();
      expect(body).toMatchObject({
        success: true,
        data: { total: 3, waiting: 3, learning: 0, learned: 0, known: 0 },
      });
    });

    it('returns 200 with counts split across statuses', async () => {
      auth.authorized({ user: { id: USER_ID } });
      await db.insert(user).values({ id: USER_ID, name: 'E2E User', email: `${USER_ID}@example.com` });
      const words = ['run', 'walk', 'jump', 'swim'];
      const { list, items } = await seedList(words);
      const postRes = await client.api.v1.users.me['vocabulary-lists'].$post({ json: { vocabularyListId: list.id } });
      const { data: userList } = await postRes.json();

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

      const res = await client.api.v1.users.me['vocabulary-lists'][':userVocabularyListId'].progress.$get({
        param: { userVocabularyListId: userList.id },
      });
      expect(res.status).toBe(200);

      const body = await res.json();
      expect(body).toMatchObject({
        success: true,
        data: { total: 4, waiting: 1, learning: 1, learned: 1, known: 1 },
      });
    });

    it('returns 401 Unauthorized when not authenticated', async () => {
      auth.unauthorized();
      const { list } = await seedList();

      const res = await client.api.v1.users.me['vocabulary-lists'][':userVocabularyListId'].progress.$get({
        param: { userVocabularyListId: list.id },
      });
      expect(res.status).toBe(401);
    });

    it('returns 404 when the user has not added the list', async () => {
      auth.authorized({ user: { id: USER_ID } });
      await db.insert(user).values({ id: USER_ID, name: 'E2E User', email: `${USER_ID}@example.com` });
      const { list } = await seedList();

      const res = await client.api.v1.users.me['vocabulary-lists'][':userVocabularyListId'].progress.$get({
        param: { userVocabularyListId: list.id },
      });
      expect(res.status).toBe(404);
    });
  });

  describe('PATCH /api/v1/users/me/vocabulary-lists/:userVocabularyListId/items/:userVocabularyItemId/status', () => {
    const addList = async (values: string[] = ['run'], title = 'Oxford 5000 A1') => {
      const { list, items } = await seedList(values, title);
      const postRes = await client.api.v1.users.me['vocabulary-lists'].$post({ json: { vocabularyListId: list.id } });
      const { data: userList } = await postRes.json();

      const userItems = await db.query.userVocabularyItem.findMany({
        where: eq(userVocabularyItem.userId, USER_ID),
      });

      return { list, items, userList, userItems };
    };

    it.each([LearningStatus.Known, LearningStatus.Learning] as const)(
      'returns 200, records a discovered event, and flips status to %s',
      async (status) => {
        auth.authorized({ user: { id: USER_ID } });
        await db.insert(user).values({ id: USER_ID, name: 'E2E User', email: `${USER_ID}@example.com` });
        const { userList, userItems } = await addList();
        const [userItem] = userItems;
        if (!userItem) throw new Error('expected a user item to be created');

        const res = await client.api.v1.users.me['vocabulary-lists'][':userVocabularyListId'].items[
          ':userVocabularyItemId'
        ].status.$patch({
          param: { userVocabularyListId: userList.id, userVocabularyItemId: userItem.id },
          json: { status, durationMs: 1234 },
        });
        expect(res.status).toBe(200);

        const body = await res.json();
        expect(body).toMatchObject({ success: true, data: { userVocabularyItemId: userItem.id, status } });

        const updated = await db.query.userVocabularyItem.findFirst({ where: eq(userVocabularyItem.id, userItem.id) });
        expect(updated?.status).toBe(status);

        const events = await db.query.event.findMany({ where: eq(event.userVocabularyItemId, userItem.id) });
        expect(events).toMatchObject([
          {
            type: EventType.UserVocabularyItemDiscovered,
            userId: USER_ID,
            userVocabularyItemId: userItem.id,
            userVocabularyListId: userList.id,
            status,
            durationMs: 1234,
          },
        ]);
      },
    );

    it('reverts to waiting and deletes the discovered event on undo', async () => {
      auth.authorized({ user: { id: USER_ID } });
      await db.insert(user).values({ id: USER_ID, name: 'E2E User', email: `${USER_ID}@example.com` });
      const { userList, userItems } = await addList();
      const [userItem] = userItems;
      if (!userItem) throw new Error('expected a user item to be created');

      await client.api.v1.users.me['vocabulary-lists'][':userVocabularyListId'].items[
        ':userVocabularyItemId'
      ].status.$patch({
        param: { userVocabularyListId: userList.id, userVocabularyItemId: userItem.id },
        json: { status: LearningStatus.Known, durationMs: 1234 },
      });

      const res = await client.api.v1.users.me['vocabulary-lists'][':userVocabularyListId'].items[
        ':userVocabularyItemId'
      ].status.$patch({
        param: { userVocabularyListId: userList.id, userVocabularyItemId: userItem.id },
        json: { status: LearningStatus.Waiting },
      });
      expect(res.status).toBe(200);

      const body = await res.json();
      expect(body).toMatchObject({
        success: true,
        data: { userVocabularyItemId: userItem.id, status: LearningStatus.Waiting },
      });

      const updated = await db.query.userVocabularyItem.findFirst({ where: eq(userVocabularyItem.id, userItem.id) });
      expect(updated?.status).toBe(LearningStatus.Waiting);

      const events = await db.query.event.findMany({
        where: and(eq(event.userVocabularyItemId, userItem.id), eq(event.type, EventType.UserVocabularyItemDiscovered)),
      });
      expect(events).toHaveLength(0);
    });

    it('returns 401 Unauthorized when not authenticated', async () => {
      auth.unauthorized();
      const { list, items } = await seedList();
      const [item] = items;
      if (!item) throw new Error('expected an item to be created');

      const res = await client.api.v1.users.me['vocabulary-lists'][':userVocabularyListId'].items[
        ':userVocabularyItemId'
      ].status.$patch({
        param: { userVocabularyListId: list.id, userVocabularyItemId: item.id },
        json: { status: LearningStatus.Known, durationMs: 1234 },
      });
      expect(res.status).toBe(401);
    });

    it('returns 404 when the user has not added the list', async () => {
      auth.authorized({ user: { id: USER_ID } });
      await db.insert(user).values({ id: USER_ID, name: 'E2E User', email: `${USER_ID}@example.com` });
      const { list, items } = await seedList();
      const [item] = items;
      if (!item) throw new Error('expected an item to be created');

      const res = await client.api.v1.users.me['vocabulary-lists'][':userVocabularyListId'].items[
        ':userVocabularyItemId'
      ].status.$patch({
        param: { userVocabularyListId: list.id, userVocabularyItemId: item.id },
        json: { status: LearningStatus.Known, durationMs: 1234 },
      });
      expect(res.status).toBe(404);
    });

    it('returns 404 when the item is not a member of the given list', async () => {
      auth.authorized({ user: { id: USER_ID } });
      await db.insert(user).values({ id: USER_ID, name: 'E2E User', email: `${USER_ID}@example.com` });
      const { userList: runUserList } = await addList(['run'], 'Oxford 5000 A1');
      await addList(['walk'], 'Oxford 5000 A2');

      const [walkUserItem] = await db
        .select({ id: userVocabularyItem.id })
        .from(userVocabularyItem)
        .innerJoin(vocabularyItem, eq(userVocabularyItem.vocabularyItemId, vocabularyItem.id))
        .where(and(eq(userVocabularyItem.userId, USER_ID), eq(vocabularyItem.value, 'walk')));
      if (!walkUserItem) throw new Error('expected a user item to be created');

      const res = await client.api.v1.users.me['vocabulary-lists'][':userVocabularyListId'].items[
        ':userVocabularyItemId'
      ].status.$patch({
        param: { userVocabularyListId: runUserList.id, userVocabularyItemId: walkUserItem.id },
        json: { status: LearningStatus.Known, durationMs: 1234 },
      });
      expect(res.status).toBe(404);
    });
  });
});
