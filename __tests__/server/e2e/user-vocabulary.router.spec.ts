import * as vocabularyTaskService from '@/server/user-vocabulary/vocabulary-task.service';
import * as vocabularyItemGenerationService from '@/server/vocabulary/vocabulary-item-generation.service';
import { afterEach, beforeEach, describe, expect, it, vi, type MockInstance } from 'vitest';
import { and, eq } from 'drizzle-orm';
import { client } from '../setup-e2e-context';
import { auth } from '../mocks/auth.middleware.mock';
import { db } from '@/server/db/db.service';
import { event, user, userVocabularyItem, vocabularyItem } from '@/server/db/db.schema';
import { countItems } from '@/server/db/db.utils';
import { createMissingVocabularyItems } from '@/server/vocabulary/vocabulary-item.repository';
import {
  createVocabularyListItemsIfNotExist,
  getVocabularyListItem,
} from '@/server/vocabulary/vocabulary-list-item.repository';
import { findOrCreateVocabularyListByTitle } from '@/server/vocabulary/vocabulary-list.service';
import { createPersonalVocabularyListForUser } from '@/server/user-vocabulary/user-vocabulary-list.service';
import { getUserVocabularyListByVocabularyListId } from '@/server/user-vocabulary/user-vocabulary-list.repository';
import { EventType, UserVocabularyItemTaskType } from '@/const/event';
import type { ErrorResponse } from '@/types/response';
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

const getUserVocabularyListByVocabularyListIdOrThrow = async ({
  userId,
  vocabularyListId,
}: {
  userId: string;
  vocabularyListId: string;
}) => {
  const userVocabularyList = await getUserVocabularyListByVocabularyListId({ userId, vocabularyListId });
  if (!userVocabularyList) throw new Error('expected a user vocabulary list');

  return userVocabularyList;
};

describe('user-vocabulary.router', () => {
  describe('GET /api/v1/users/me/vocabulary-lists/available', () => {
    it('returns 200 with lists', async () => {
      auth.authorized();
      await seedList();

      const res = await client.api.v1.users.me['vocabulary-lists'].available.$get();
      expect(res.status).toBe(200);

      const body = await res.json();
      expect(body).toMatchObject({
        success: true,
        data: [{ title: 'Oxford 5000 A1', userVocabularyList: null }],
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
        data: [
          {
            id: list.id,
            title: 'Oxford 5000 A1',
            userVocabularyList: {
              vocabularyListId: list.id,
              createdAt: expect.any(String),
            },
          },
          { userVocabularyList: null },
        ],
      });
    });

    it("returns the user's personal list first, ahead of an enrolled public list", async () => {
      auth.authorized({ user: { id: USER_ID } });
      await db.insert(user).values({ id: USER_ID, name: 'E2E User', email: `${USER_ID}@example.com` });
      const { list } = await seedList();
      await client.api.v1.users.me['vocabulary-lists'].$post({ json: { vocabularyListId: list.id } });
      const personalList = await createPersonalVocabularyListForUser(USER_ID);

      const res = await client.api.v1.users.me['vocabulary-lists'].available.$get();

      const body = await res.json();
      expect(body).toMatchObject({
        success: true,
        data: [
          { id: personalList.id, title: null, type: 'personal' },
          { id: list.id, title: 'Oxford 5000 A1' },
        ],
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

  describe('POST /api/v1/users/me/vocabulary-lists/personal/items', () => {
    it("returns 201 and links the word to the user's personal list", async () => {
      auth.authorized({ user: { id: USER_ID } });
      await db.insert(user).values({ id: USER_ID, name: 'E2E User', email: `${USER_ID}@example.com` });
      const { items } = await seedList();
      const [item] = items;
      if (!item) throw new Error('expected an item to be created');
      const personalList = await createPersonalVocabularyListForUser(USER_ID);

      const res = await client.api.v1.users.me['vocabulary-lists'].personal.items.$post({
        json: { vocabularyItemId: item.id },
      });
      expect(res.status).toBe(201);

      const body = await res.json();
      expect(body).toMatchObject({
        success: true,
        data: { vocabularyItemId: item.id, status: LearningStatus.Learning, vocabularyItem: { id: item.id } },
      });

      await expect(
        getVocabularyListItem({ vocabularyListId: personalList.id, vocabularyItemId: item.id }),
      ).resolves.toBeDefined();
    });

    it('returns 401 Unauthorized when not authenticated', async () => {
      auth.unauthorized();
      const { items } = await seedList();
      const [item] = items;
      if (!item) throw new Error('expected an item to be created');

      const res = await client.api.v1.users.me['vocabulary-lists'].personal.items.$post({
        json: { vocabularyItemId: item.id },
      });
      expect(res.status).toBe(401);
    });

    it('returns 404 for a non-existent item', async () => {
      auth.authorized({ user: { id: USER_ID } });
      await db.insert(user).values({ id: USER_ID, name: 'E2E User', email: `${USER_ID}@example.com` });
      await createPersonalVocabularyListForUser(USER_ID);

      const res = await client.api.v1.users.me['vocabulary-lists'].personal.items.$post({
        json: { vocabularyItemId: '00000000-0000-7000-8000-000000000000' },
      });
      expect(res.status).toBe(404);
    });

    it('returns 409 when the word is already in the personal list', async () => {
      auth.authorized({ user: { id: USER_ID } });
      await db.insert(user).values({ id: USER_ID, name: 'E2E User', email: `${USER_ID}@example.com` });
      const { items } = await seedList();
      const [item] = items;
      if (!item) throw new Error('expected an item to be created');
      await createPersonalVocabularyListForUser(USER_ID);

      const addItem = () =>
        client.api.v1.users.me['vocabulary-lists'].personal.items.$post({
          json: { vocabularyItemId: item.id },
        });

      expect((await addItem()).status).toBe(201);
      expect((await addItem()).status).toBe(409);
    });

    it('resets progress by default when re-adding a previously removed word', async () => {
      auth.authorized({ user: { id: USER_ID } });
      await db.insert(user).values({ id: USER_ID, name: 'E2E User', email: `${USER_ID}@example.com` });
      const { items } = await seedList();
      const [item] = items;
      if (!item) throw new Error('expected an item to be created');
      await createPersonalVocabularyListForUser(USER_ID);
      const addRes = await client.api.v1.users.me['vocabulary-lists'].personal.items.$post({
        json: { vocabularyItemId: item.id },
      });
      if (!addRes.ok) throw new Error('expected item to be added');
      const { data: addedItem } = await addRes.json();
      await db
        .update(userVocabularyItem)
        .set({ status: LearningStatus.Learned, encounterCount: 5 })
        .where(eq(userVocabularyItem.id, addedItem.id));
      await client.api.v1.users.me['vocabulary-lists'].personal.items[':userVocabularyItemId'].$delete({
        param: { userVocabularyItemId: addedItem.id },
        json: { isReset: false },
      });

      const res = await client.api.v1.users.me['vocabulary-lists'].personal.items.$post({
        json: { vocabularyItemId: item.id },
      });
      expect(res.status).toBe(201);

      const body = await res.json();
      expect(body).toMatchObject({
        success: true,
        data: { vocabularyItemId: item.id, status: LearningStatus.Learning, encounterCount: 0 },
      });
    });

    it('preserves progress when isResetToLearning is false', async () => {
      auth.authorized({ user: { id: USER_ID } });
      await db.insert(user).values({ id: USER_ID, name: 'E2E User', email: `${USER_ID}@example.com` });
      const { items } = await seedList();
      const [item] = items;
      if (!item) throw new Error('expected an item to be created');
      await createPersonalVocabularyListForUser(USER_ID);
      const addRes = await client.api.v1.users.me['vocabulary-lists'].personal.items.$post({
        json: { vocabularyItemId: item.id },
      });
      if (!addRes.ok) throw new Error('expected item to be added');
      const { data: addedItem } = await addRes.json();
      await db
        .update(userVocabularyItem)
        .set({ status: LearningStatus.Learned, encounterCount: 5 })
        .where(eq(userVocabularyItem.id, addedItem.id));
      await client.api.v1.users.me['vocabulary-lists'].personal.items[':userVocabularyItemId'].$delete({
        param: { userVocabularyItemId: addedItem.id },
        json: { isReset: false },
      });

      const res = await client.api.v1.users.me['vocabulary-lists'].personal.items.$post({
        json: { vocabularyItemId: item.id, isResetToLearning: false },
      });
      expect(res.status).toBe(201);

      const body = await res.json();
      expect(body).toMatchObject({
        success: true,
        data: { vocabularyItemId: item.id, status: LearningStatus.Learned, encounterCount: 5 },
      });

      const resetEvents = await db.query.event.findMany({
        where: and(eq(event.userId, USER_ID), eq(event.type, EventType.UserVocabularyItemProgressReset)),
      });
      expect(resetEvents).toEqual([]);
    });
  });

  describe('DELETE /api/v1/users/me/vocabulary-lists/personal/items/:userVocabularyItemId', () => {
    it("returns 200, unlinks the word from the user's personal list, and preserves progress", async () => {
      auth.authorized({ user: { id: USER_ID } });
      await db.insert(user).values({ id: USER_ID, name: 'E2E User', email: `${USER_ID}@example.com` });
      const { items } = await seedList();
      const [item] = items;
      if (!item) throw new Error('expected an item to be created');
      const personalList = await createPersonalVocabularyListForUser(USER_ID);
      const userVocabularyList = await getUserVocabularyListByVocabularyListIdOrThrow({
        userId: USER_ID,
        vocabularyListId: personalList.id,
      });
      const addRes = await client.api.v1.users.me['vocabulary-lists'].personal.items.$post({
        json: { vocabularyItemId: item.id },
      });
      if (!addRes.ok) throw new Error('expected item to be added');
      const { data: addedItem } = await addRes.json();
      await db
        .update(userVocabularyItem)
        .set({ status: LearningStatus.Learning, encounterCount: 2 })
        .where(eq(userVocabularyItem.vocabularyItemId, item.id));

      const res = await client.api.v1.users.me['vocabulary-lists'].personal.items[':userVocabularyItemId'].$delete({
        param: { userVocabularyItemId: addedItem.id },
        json: { isReset: false },
      });
      expect(res.status).toBe(200);

      const body = await res.json();
      expect(body).toMatchObject({ success: true, data: { userVocabularyItemId: addedItem.id } });

      await expect(
        getVocabularyListItem({ vocabularyListId: personalList.id, vocabularyItemId: item.id }),
      ).resolves.toBeUndefined();

      const progressRow = await db.query.userVocabularyItem.findFirst({
        where: eq(userVocabularyItem.vocabularyItemId, item.id),
      });
      expect(progressRow).toMatchObject({ status: LearningStatus.Learning, encounterCount: 2 });

      const events = await db.query.event.findMany({
        where: and(eq(event.userId, USER_ID), eq(event.type, EventType.UserVocabularyItemRemovedFromList)),
      });
      expect(events).toMatchObject([
        {
          vocabularyItemId: item.id,
          userVocabularyListId: userVocabularyList.id,
          status: LearningStatus.Learning,
          encounterCount: 2,
        },
      ]);

      const resetEvents = await db.query.event.findMany({
        where: and(eq(event.userId, USER_ID), eq(event.type, EventType.UserVocabularyItemProgressReset)),
      });
      expect(resetEvents).toEqual([]);
    });

    it('resets progress to waiting when isReset is true', async () => {
      auth.authorized({ user: { id: USER_ID } });
      await db.insert(user).values({ id: USER_ID, name: 'E2E User', email: `${USER_ID}@example.com` });
      const { items } = await seedList();
      const [item] = items;
      if (!item) throw new Error('expected an item to be created');
      const personalList = await createPersonalVocabularyListForUser(USER_ID);
      const userVocabularyList = await getUserVocabularyListByVocabularyListIdOrThrow({
        userId: USER_ID,
        vocabularyListId: personalList.id,
      });
      const addRes = await client.api.v1.users.me['vocabulary-lists'].personal.items.$post({
        json: { vocabularyItemId: item.id },
      });
      if (!addRes.ok) throw new Error('expected item to be added');
      const { data: addedItem } = await addRes.json();
      await db
        .update(userVocabularyItem)
        .set({ status: LearningStatus.Learned, encounterCount: 3 })
        .where(eq(userVocabularyItem.vocabularyItemId, item.id));

      const res = await client.api.v1.users.me['vocabulary-lists'].personal.items[':userVocabularyItemId'].$delete({
        param: { userVocabularyItemId: addedItem.id },
        json: { isReset: true },
      });
      expect(res.status).toBe(200);

      const progressRow = await db.query.userVocabularyItem.findFirst({
        where: eq(userVocabularyItem.vocabularyItemId, item.id),
      });
      expect(progressRow).toMatchObject({ status: LearningStatus.Waiting, encounterCount: 0, enqueuedAt: null });

      const events = await db.query.event.findMany({
        where: and(eq(event.userId, USER_ID), eq(event.type, EventType.UserVocabularyItemRemovedFromList)),
      });
      expect(events).toMatchObject([{ status: LearningStatus.Learned, encounterCount: 3 }]);

      const resetEvents = await db.query.event.findMany({
        where: and(eq(event.userId, USER_ID), eq(event.type, EventType.UserVocabularyItemProgressReset)),
      });
      expect(resetEvents).toMatchObject([
        {
          userVocabularyItemId: addedItem.id,
          userVocabularyListId: userVocabularyList.id,
          status: LearningStatus.Waiting,
          encounterCount: 3,
        },
      ]);
    });

    it('returns 401 Unauthorized when not authenticated', async () => {
      auth.unauthorized();

      const res = await client.api.v1.users.me['vocabulary-lists'].personal.items[':userVocabularyItemId'].$delete({
        param: { userVocabularyItemId: '00000000-0000-7000-8000-000000000000' },
        json: { isReset: false },
      });
      expect(res.status).toBe(401);
    });

    it('returns 404 for a non-existent item', async () => {
      auth.authorized({ user: { id: USER_ID } });
      await db.insert(user).values({ id: USER_ID, name: 'E2E User', email: `${USER_ID}@example.com` });
      await createPersonalVocabularyListForUser(USER_ID);

      const res = await client.api.v1.users.me['vocabulary-lists'].personal.items[':userVocabularyItemId'].$delete({
        param: { userVocabularyItemId: '00000000-0000-7000-8000-000000000000' },
        json: { isReset: false },
      });
      expect(res.status).toBe(404);
    });
  });

  describe('POST /api/v1/users/me/vocabulary-lists/personal/items/generate', () => {
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
            isLearnable: true,
          },
          cost: { costInNanoDollars: 1_000_000, inputTokens: 100, outputTokens: 200 },
        }));
    });

    afterEach(() => {
      generateSpy.mockRestore();
    });

    it("returns 201, persists the generated word, and links it to the user's personal list", async () => {
      auth.authorized({ user: { id: USER_ID } });
      await db.insert(user).values({ id: USER_ID, name: 'E2E User', email: `${USER_ID}@example.com` });
      await createPersonalVocabularyListForUser(USER_ID);

      const res = await client.api.v1.users.me['vocabulary-lists'].personal.items.generate.$post({
        json: { value: 'run', context: 'a jog' },
      });
      expect(res.status).toBe(201);

      const body = await res.json();
      expect(body).toMatchObject({
        success: true,
        data: {
          status: LearningStatus.Learning,
          vocabularyItem: { value: 'run', definition: 'definition of run', partOfSpeech: PartOfSpeech.Noun },
        },
      });

      const items = await db.query.vocabularyItem.findMany({ where: eq(vocabularyItem.value, 'run') });
      expect(items).toHaveLength(1);

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

    it('returns 409 and still records the event when the generated word already exists', async () => {
      auth.authorized({ user: { id: USER_ID } });
      await db.insert(user).values({ id: USER_ID, name: 'E2E User', email: `${USER_ID}@example.com` });
      await createMissingVocabularyItems([
        {
          value: 'run',
          definition: 'existing definition',
          uaTranslation: 'existing translation',
          partOfSpeech: PartOfSpeech.Noun,
          spelling: '/run/',
        },
      ]);
      const personalList = await createPersonalVocabularyListForUser(USER_ID);

      const res = await client.api.v1.users.me['vocabulary-lists'].personal.items.generate.$post({
        json: { value: 'run' },
      });
      expect(res.status).toBe(409);

      const items = await db.query.vocabularyItem.findMany({ where: eq(vocabularyItem.value, 'run') });
      expect(items).toHaveLength(1);
      const [item] = items;
      if (!item) throw new Error('expected the pre-seeded item to still exist');

      const events = await db.query.event.findMany({ where: eq(event.userId, USER_ID) });
      expect(events).toHaveLength(1);

      await expect(
        getVocabularyListItem({ vocabularyListId: personalList.id, vocabularyItemId: item.id }),
      ).resolves.toBeUndefined();
    });

    it('returns 400 when value is missing', async () => {
      auth.authorized();

      const res = await client.api.v1.users.me['vocabulary-lists'].personal.items.generate.$post({
        json: {} as never,
      });
      expect(res.status).toBe(400);
    });

    it('returns 401 Unauthorized when not authenticated', async () => {
      auth.unauthorized();

      const res = await client.api.v1.users.me['vocabulary-lists'].personal.items.generate.$post({
        json: { value: 'run' },
      });
      expect(res.status).toBe(401);
    });

    it('returns 429 Too Many Requests after 20 requests within the rate-limit window', async () => {
      const rateLimitedUserId = 'user-generate-rate-limit';
      auth.authorized({ user: { id: rateLimitedUserId } });
      await db
        .insert(user)
        .values({ id: rateLimitedUserId, name: 'E2E User', email: `${rateLimitedUserId}@example.com` });
      await createPersonalVocabularyListForUser(rateLimitedUserId);

      for (let i = 0; i < 20; i++) {
        const res = await client.api.v1.users.me['vocabulary-lists'].personal.items.generate.$post({
          json: { value: `run${i}` },
        });
        expect(res.status).toBe(201);
      }

      const res = await client.api.v1.users.me['vocabulary-lists'].personal.items.generate.$post({
        json: { value: 'run20' },
      });
      expect(res.status).toBe(429);

      const body = (await res.json()) as unknown as ErrorResponse;
      expect(body.error.code).toBe('TOO_MANY_REQUESTS');
    });
  });

  describe('GET /api/v1/users/me/vocabulary-lists/personal/search', () => {
    it('returns 200 with matches not yet on the list marked as null', async () => {
      auth.authorized({ user: { id: USER_ID } });
      await db.insert(user).values({ id: USER_ID, name: 'E2E User', email: `${USER_ID}@example.com` });
      await seedList(['Run', 'running', 'jump']);
      await createPersonalVocabularyListForUser(USER_ID);

      const res = await client.api.v1.users.me['vocabulary-lists'].personal.search.$get({
        query: { value: 'run' },
      });
      expect(res.status).toBe(200);

      const body = await res.json();
      expect(body).toMatchObject({
        success: true,
        data: [
          { value: 'Run', vocabularyListItem: null },
          { value: 'running', vocabularyListItem: null },
        ],
        pageInfo: { total: 2, count: 2 },
      });
    });

    it('returns 200 with an already-added word carrying its list item', async () => {
      auth.authorized({ user: { id: USER_ID } });
      await db.insert(user).values({ id: USER_ID, name: 'E2E User', email: `${USER_ID}@example.com` });
      const { items } = await seedList(['run']);
      const [item] = items;
      if (!item) throw new Error('expected an item to be created');
      const personalList = await createPersonalVocabularyListForUser(USER_ID);
      await client.api.v1.users.me['vocabulary-lists'].personal.items.$post({
        json: { vocabularyItemId: item.id },
      });

      const res = await client.api.v1.users.me['vocabulary-lists'].personal.search.$get({
        query: { value: 'run' },
      });
      expect(res.status).toBe(200);

      const body = await res.json();
      expect(body).toMatchObject({
        success: true,
        data: [{ value: 'run', vocabularyListItem: { vocabularyListId: personalList.id, vocabularyItemId: item.id } }],
      });
    });

    it('paginates items across pages honoring limit and cursor', async () => {
      auth.authorized({ user: { id: USER_ID } });
      await db.insert(user).values({ id: USER_ID, name: 'E2E User', email: `${USER_ID}@example.com` });
      await seedList(['run1', 'run2', 'run3']);
      await createPersonalVocabularyListForUser(USER_ID);

      const firstRes = await client.api.v1.users.me['vocabulary-lists'].personal.search.$get({
        query: { value: 'run', limit: '2' },
      });
      expect(firstRes.status).toBe(200);
      if (!firstRes.ok) throw new Error('expected a successful response');
      const firstBody = await firstRes.json();
      expect(firstBody.data).toHaveLength(2);
      expect(firstBody.pageInfo).toMatchObject({ total: 3, count: 2 });
      expect(firstBody.pageInfo.nextCursor).toEqual(expect.any(String));

      const secondRes = await client.api.v1.users.me['vocabulary-lists'].personal.search.$get({
        query: { value: 'run', limit: '2', cursor: firstBody.pageInfo.nextCursor },
      });
      expect(secondRes.status).toBe(200);
      if (!secondRes.ok) throw new Error('expected a successful response');
      const secondBody = await secondRes.json();
      expect(secondBody.data).toHaveLength(1);
      expect(secondBody.pageInfo).toMatchObject({ total: 3, count: 1 });
      expect(secondBody.pageInfo.nextCursor).toBeUndefined();
    });

    it('returns 400 when value is missing', async () => {
      auth.authorized({ user: { id: USER_ID } });
      await db.insert(user).values({ id: USER_ID, name: 'E2E User', email: `${USER_ID}@example.com` });
      await createPersonalVocabularyListForUser(USER_ID);

      const res = await client.api.v1.users.me['vocabulary-lists'].personal.search.$get({
        query: {} as never,
      });
      expect(res.status).toBe(400);
    });

    it('returns 401 Unauthorized when not authenticated', async () => {
      auth.unauthorized();

      const res = await client.api.v1.users.me['vocabulary-lists'].personal.search.$get({
        query: { value: 'run' },
      });
      expect(res.status).toBe(401);
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
    it('returns 200 with the items the user has added to the list', async () => {
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
        data: [
          {
            id: expect.any(String),
            vocabularyItemId: expect.any(String),
            status: LearningStatus.Waiting,
            vocabularyItem: { value: 'run' },
          },
        ],
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
      const itemValues = ['run', 'walk', 'jump', 'swim', 'fly'];
      const { list } = await seedList(itemValues);
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

      // pages must be disjoint and together cover every item exactly once
      const pagedValues = [...firstBody.data, ...secondBody.data, ...thirdBody.data].map(
        (item) => item.vocabularyItem.value,
      );
      expect(pagedValues).toEqual(itemValues);
    });

    it('returns every item in the list exactly once when following nextCursor to the end', async () => {
      auth.authorized({ user: { id: USER_ID } });
      await db.insert(user).values({ id: USER_ID, name: 'E2E User', email: `${USER_ID}@example.com` });
      const itemValues = ['run', 'walk', 'jump', 'swim', 'fly', 'read', 'write'];
      const { list } = await seedList(itemValues);
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
        expect(body.pageInfo.total).toBe(itemValues.length);
        collected.push(...body.data.map((item) => item.vocabularyItem.value));
        cursor = body.pageInfo.nextCursor;
      } while (cursor);

      expect(collected).toEqual(itemValues);
      expect(new Set(collected).size).toBe(itemValues.length);
    });
  });

  describe('GET /api/v1/users/me/vocabulary-lists/:userVocabularyListId/learn/items', () => {
    it('returns a batch of Learn items following the [new, review, review, new, review, review] pattern', async () => {
      auth.authorized({ user: { id: USER_ID } });
      await db.insert(user).values({ id: USER_ID, name: 'E2E User', email: `${USER_ID}@example.com` });
      const itemValues = ['run', 'walk', 'jump', 'swim', 'fly', 'read', 'write', 'sing'];
      const { list } = await seedList(itemValues);
      const postRes = await client.api.v1.users.me['vocabulary-lists'].$post({ json: { vocabularyListId: list.id } });
      const { data: userList } = await postRes.json();

      const userItems = await db.query.userVocabularyItem.findMany({
        where: eq(userVocabularyItem.userId, USER_ID),
        orderBy: (userVocabularyItem, { asc }) => asc(userVocabularyItem.id),
      });

      // first 4 items become "review" items (already reviewed once), the rest stay "new" (never confirmed)
      for (const [index, userItem] of userItems.entries()) {
        await db
          .update(userVocabularyItem)
          .set({ status: LearningStatus.Learning, encounterCount: index < 4 ? 1 : 0 })
          .where(eq(userVocabularyItem.id, userItem.id));
      }

      const res = await client.api.v1.users.me['vocabulary-lists'][':userVocabularyListId'].learn.items.$get({
        param: { userVocabularyListId: userList.id },
      });
      expect(res.status).toBe(200);

      const body = await res.json();
      expect(body.success).toBe(true);
      expect(body.data).toHaveLength(6);

      const newItems = itemValues.slice(4);
      const reviewItems = itemValues.slice(0, 4);
      const kinds = body.data.map((item) => (newItems.includes(item.vocabularyItem.value) ? 'new' : 'review'));
      expect(kinds).toEqual(['new', 'review', 'review', 'new', 'review', 'review']);
      expect(new Set(body.data.map((item) => item.vocabularyItem.value)).size).toBe(6);
      for (const item of body.data) {
        expect([...newItems, ...reviewItems]).toContain(item.vocabularyItem.value);
      }
    });

    it('fills the batch from the other pool when one type does not have enough items', async () => {
      auth.authorized({ user: { id: USER_ID } });
      await db.insert(user).values({ id: USER_ID, name: 'E2E User', email: `${USER_ID}@example.com` });
      const itemValues = ['run', 'walk', 'jump', 'swim', 'fly', 'read', 'write', 'sing'];
      const { list } = await seedList(itemValues);
      const postRes = await client.api.v1.users.me['vocabulary-lists'].$post({ json: { vocabularyListId: list.id } });
      const { data: userList } = await postRes.json();

      const userItems = await db.query.userVocabularyItem.findMany({
        where: eq(userVocabularyItem.userId, USER_ID),
        orderBy: (userVocabularyItem, { asc }) => asc(userVocabularyItem.id),
      });

      // only 1 item stays "new"; the other 7 are review items, so the new pool runs out and review items fill the batch
      for (const [index, userItem] of userItems.entries()) {
        await db
          .update(userVocabularyItem)
          .set({ status: LearningStatus.Learning, encounterCount: index < 1 ? 0 : 1 })
          .where(eq(userVocabularyItem.id, userItem.id));
      }

      const res = await client.api.v1.users.me['vocabulary-lists'][':userVocabularyListId'].learn.items.$get({
        param: { userVocabularyListId: userList.id },
      });
      expect(res.status).toBe(200);

      const body = await res.json();
      expect(body.success).toBe(true);
      expect(body.data).toHaveLength(6);

      const newItems = itemValues.slice(0, 1);
      const reviewItems = itemValues.slice(1);
      const kinds = body.data.map((item) => (newItems.includes(item.vocabularyItem.value) ? 'new' : 'review'));
      expect(kinds.filter((kind) => kind === 'new')).toHaveLength(1);
      expect(kinds.filter((kind) => kind === 'review')).toHaveLength(5);
      expect(new Set(body.data.map((item) => item.vocabularyItem.value)).size).toBe(6);
      for (const item of body.data) {
        expect([...newItems, ...reviewItems]).toContain(item.vocabularyItem.value);
      }
    });

    it('returns 6 new items when all items are new', async () => {
      auth.authorized({ user: { id: USER_ID } });
      await db.insert(user).values({ id: USER_ID, name: 'E2E User', email: `${USER_ID}@example.com` });
      const itemValues = ['run', 'walk', 'jump', 'swim', 'fly', 'read', 'write', 'sing'];
      const { list } = await seedList(itemValues);
      const postRes = await client.api.v1.users.me['vocabulary-lists'].$post({ json: { vocabularyListId: list.id } });
      const { data: userList } = await postRes.json();

      await db
        .update(userVocabularyItem)
        .set({ status: LearningStatus.Learning, encounterCount: 0 })
        .where(eq(userVocabularyItem.userId, USER_ID));

      const res = await client.api.v1.users.me['vocabulary-lists'][':userVocabularyListId'].learn.items.$get({
        param: { userVocabularyListId: userList.id },
      });
      expect(res.status).toBe(200);

      const body = await res.json();
      expect(body.success).toBe(true);
      expect(body.data).toHaveLength(6);
      expect(body.data.every((item) => item.encounterCount === 0)).toBe(true);
      expect(new Set(body.data.map((item) => item.vocabularyItem.value)).size).toBe(6);
      for (const item of body.data) {
        expect(itemValues).toContain(item.vocabularyItem.value);
      }
    });

    it('returns 401 Unauthorized when not authenticated', async () => {
      auth.unauthorized();
      const { list } = await seedList();

      const res = await client.api.v1.users.me['vocabulary-lists'][':userVocabularyListId'].learn.items.$get({
        param: { userVocabularyListId: list.id },
      });
      expect(res.status).toBe(401);
    });

    it('returns 404 when the user has not added the list', async () => {
      auth.authorized({ user: { id: USER_ID } });
      await db.insert(user).values({ id: USER_ID, name: 'E2E User', email: `${USER_ID}@example.com` });
      const { list } = await seedList();

      const res = await client.api.v1.users.me['vocabulary-lists'][':userVocabularyListId'].learn.items.$get({
        param: { userVocabularyListId: list.id },
      });
      expect(res.status).toBe(404);
    });
  });

  describe('GET /api/v1/users/me/vocabulary-lists/:userVocabularyListId/learn/tasks', () => {
    let englishSpy: MockInstance<typeof vocabularyTaskService.toTranslateEnglishSentence>;
    let ukrainianSpy: MockInstance<typeof vocabularyTaskService.toTranslateUkrainianSentence>;

    beforeEach(() => {
      const english = vi
        .spyOn(vocabularyTaskService, 'toTranslateEnglishSentence')
        .mockImplementation(async (items) => ({
          reasoning: [],
          tasks: items.map(({ id }) => ({ id, sentence: `EN sentence ${id}`, translation: `UA translation ${id}` })),
          cost: {
            taskType: UserVocabularyItemTaskType.TranslateEnglishSentence,
            costInNanoDollars: 100,
            inputTokens: 10,
            outputTokens: 5,
          },
        }));

      const ukrainian = vi
        .spyOn(vocabularyTaskService, 'toTranslateUkrainianSentence')
        .mockImplementation(async (items) => ({
          reasoning: [],
          tasks: items.map(({ id }) => ({ id, sentence: `UA sentence ${id}`, translation: `EN translation ${id}` })),
          cost: {
            taskType: UserVocabularyItemTaskType.TranslateUkrainianSentence,
            costInNanoDollars: 200,
            inputTokens: 20,
            outputTokens: 10,
          },
        }));

      englishSpy = english;
      ukrainianSpy = ukrainian;
    });

    afterEach(() => {
      englishSpy.mockRestore();
      ukrainianSpy.mockRestore();
    });

    it('returns 401 Unauthorized when not authenticated', async () => {
      auth.unauthorized();
      const { list } = await seedList();

      const res = await client.api.v1.users.me['vocabulary-lists'][':userVocabularyListId'].learn.tasks.$get({
        param: { userVocabularyListId: list.id },
      });
      expect(res.status).toBe(401);
    });

    it('returns 404 when the user has not added the list', async () => {
      auth.authorized({ user: { id: USER_ID } });
      await db.insert(user).values({ id: USER_ID, name: 'E2E User', email: `${USER_ID}@example.com` });
      const { list } = await seedList();

      const res = await client.api.v1.users.me['vocabulary-lists'][':userVocabularyListId'].learn.tasks.$get({
        param: { userVocabularyListId: list.id },
      });
      expect(res.status).toBe(404);
    });

    it('returns tasks for the current Learn batch and records a task-generated event per generator', async () => {
      auth.authorized({ user: { id: USER_ID } });
      await db.insert(user).values({ id: USER_ID, name: 'E2E User', email: `${USER_ID}@example.com` });
      const itemValues = ['run', 'walk', 'jump', 'swim', 'fly', 'read'];
      const { list } = await seedList(itemValues);
      const postRes = await client.api.v1.users.me['vocabulary-lists'].$post({ json: { vocabularyListId: list.id } });
      const { data: userList } = await postRes.json();

      await db
        .update(userVocabularyItem)
        .set({ status: LearningStatus.Learning, encounterCount: 0 })
        .where(eq(userVocabularyItem.userId, USER_ID));

      const itemsRes = await client.api.v1.users.me['vocabulary-lists'][':userVocabularyListId'].learn.items.$get({
        param: { userVocabularyListId: userList.id },
      });
      const itemsBody = await itemsRes.json();
      const expectedIds = itemsBody.data.map((item) => item.id);
      expect(expectedIds).toHaveLength(6);

      const res = await client.api.v1.users.me['vocabulary-lists'][':userVocabularyListId'].learn.tasks.$get({
        param: { userVocabularyListId: userList.id },
      });
      expect(res.status).toBe(200);

      const body = await res.json();
      expect(body.success).toBe(true);
      expect(body.data.translateEnglishSentenceTasks.map((task) => task.id)).toEqual(expectedIds);
      expect(body.data.translateUkrainianSentenceTasks.map((task) => task.id)).toEqual(expectedIds);

      const events = await db.query.event.findMany({
        where: and(
          eq(event.userVocabularyListId, userList.id),
          eq(event.type, EventType.UserVocabularyItemTaskGenerated),
        ),
      });
      expect(events).toHaveLength(2);
    });

    it('returns empty task arrays and does not call the AI SDK when the Learn queue is empty', async () => {
      auth.authorized({ user: { id: USER_ID } });
      await db.insert(user).values({ id: USER_ID, name: 'E2E User', email: `${USER_ID}@example.com` });
      const { list } = await seedList();
      const postRes = await client.api.v1.users.me['vocabulary-lists'].$post({ json: { vocabularyListId: list.id } });
      const { data: userList } = await postRes.json();

      const res = await client.api.v1.users.me['vocabulary-lists'][':userVocabularyListId'].learn.tasks.$get({
        param: { userVocabularyListId: userList.id },
      });
      expect(res.status).toBe(200);

      const body = await res.json();
      expect(body.data).toEqual({ translateEnglishSentenceTasks: [], translateUkrainianSentenceTasks: [] });
      expect(englishSpy).not.toHaveBeenCalled();
      expect(ukrainianSpy).not.toHaveBeenCalled();
    });

    it('returns matching items and tasks across repeated concurrent requests, with no conflicts between calls', async () => {
      auth.authorized({ user: { id: USER_ID } });
      await db.insert(user).values({ id: USER_ID, name: 'E2E User', email: `${USER_ID}@example.com` });
      const itemValues = ['run', 'walk', 'jump', 'swim', 'fly', 'read'];
      const { list } = await seedList(itemValues);
      const postRes = await client.api.v1.users.me['vocabulary-lists'].$post({ json: { vocabularyListId: list.id } });
      const { data: userList } = await postRes.json();

      await db
        .update(userVocabularyItem)
        .set({ status: LearningStatus.Learning, encounterCount: 0 })
        .where(eq(userVocabularyItem.userId, USER_ID));

      const [itemsResponses, tasksResponses] = await Promise.all([
        Promise.all(
          Array.from({ length: 3 }, () =>
            client.api.v1.users.me['vocabulary-lists'][':userVocabularyListId'].learn.items.$get({
              param: { userVocabularyListId: userList.id },
            }),
          ),
        ),
        Promise.all(
          Array.from({ length: 3 }, () =>
            client.api.v1.users.me['vocabulary-lists'][':userVocabularyListId'].learn.tasks.$get({
              param: { userVocabularyListId: userList.id },
            }),
          ),
        ),
      ]);

      for (const res of [...itemsResponses, ...tasksResponses]) {
        expect(res.status).toBe(200);
      }

      const itemIdsPerResponse = await Promise.all(
        itemsResponses.map(async (res) => (await res.json()).data.map((item) => item.id)),
      );
      const taskBodies = await Promise.all(tasksResponses.map((res) => res.json()));

      // all 6 concurrent requests (3x /learn/items, 3x /learn/tasks) must agree on the exact same batch,
      // in the same order, with no cross-request conflicts
      const [expectedIds] = itemIdsPerResponse;
      expect(expectedIds).toHaveLength(6);
      for (const itemIds of itemIdsPerResponse) {
        expect(itemIds).toEqual(expectedIds);
      }
      for (const taskBody of taskBodies) {
        expect(taskBody.data.translateEnglishSentenceTasks.map((task) => task.id)).toEqual(expectedIds);
        expect(taskBody.data.translateUkrainianSentenceTasks.map((task) => task.id)).toEqual(expectedIds);
      }
    });

    it('returns 429 Too Many Requests after 10 requests within the rate-limit window', async () => {
      const rateLimitedUserId = 'user-learn-tasks-rate-limit';
      auth.authorized({ user: { id: rateLimitedUserId } });
      await db
        .insert(user)
        .values({ id: rateLimitedUserId, name: 'E2E User', email: `${rateLimitedUserId}@example.com` });
      const { list } = await seedList();
      const postRes = await client.api.v1.users.me['vocabulary-lists'].$post({ json: { vocabularyListId: list.id } });
      const { data: userList } = await postRes.json();

      for (let i = 0; i < 10; i++) {
        const res = await client.api.v1.users.me['vocabulary-lists'][':userVocabularyListId'].learn.tasks.$get({
          param: { userVocabularyListId: userList.id },
        });
        expect(res.status).toBe(200);
      }

      const res = await client.api.v1.users.me['vocabulary-lists'][':userVocabularyListId'].learn.tasks.$get({
        param: { userVocabularyListId: userList.id },
      });
      expect(res.status).toBe(429);

      const body = (await res.json()) as unknown as ErrorResponse;
      expect(body.error.code).toBe('TOO_MANY_REQUESTS');
    });
  });

  describe('GET /api/v1/users/me/vocabulary-lists/:userVocabularyListId/progress', () => {
    it('returns 200 with all items waiting right after adding a list', async () => {
      auth.authorized({ user: { id: USER_ID } });
      await db.insert(user).values({ id: USER_ID, name: 'E2E User', email: `${USER_ID}@example.com` });
      const itemValues = ['run', 'walk', 'jump'];
      const { list } = await seedList(itemValues);
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
      const itemValues = ['run', 'walk', 'jump', 'swim'];
      const { list, items } = await seedList(itemValues);
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

  describe('POST /api/v1/users/me/vocabulary-lists/:userVocabularyListId/items/:userVocabularyItemId/discover', () => {
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
        ].discover.$post({
          param: { userVocabularyListId: userList.id, userVocabularyItemId: userItem.id },
          json: { status, durationMs: 1234 },
        });
        expect(res.status).toBe(200);

        const body = await res.json();
        expect(body).toMatchObject({
          success: true,
          data: {
            id: userItem.id,
            userId: USER_ID,
            vocabularyItemId: userItem.vocabularyItemId,
            status,
            vocabularyItem: { id: userItem.vocabularyItemId },
          },
        });

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

    it('returns 401 Unauthorized when not authenticated', async () => {
      auth.unauthorized();
      const { list, items } = await seedList();
      const [item] = items;
      if (!item) throw new Error('expected an item to be created');

      const res = await client.api.v1.users.me['vocabulary-lists'][':userVocabularyListId'].items[
        ':userVocabularyItemId'
      ].discover.$post({
        param: { userVocabularyListId: list.id, userVocabularyItemId: item.id },
        json: { status: LearningStatus.Known, durationMs: 1234 },
      });
      expect(res.status).toBe(401);
    });

    it('returns 400 for an invalid duration', async () => {
      auth.authorized({ user: { id: USER_ID } });
      await db.insert(user).values({ id: USER_ID, name: 'E2E User', email: `${USER_ID}@example.com` });
      const { userList, userItems } = await addList();
      const [userItem] = userItems;
      if (!userItem) throw new Error('expected a user item to be created');

      const res = await client.api.v1.users.me['vocabulary-lists'][':userVocabularyListId'].items[
        ':userVocabularyItemId'
      ].discover.$post({
        param: { userVocabularyListId: userList.id, userVocabularyItemId: userItem.id },
        json: { status: LearningStatus.Known, durationMs: -1 },
      });

      expect(res.status).toBe(400);
    });

    it('returns 404 when the user has not added the list', async () => {
      auth.authorized({ user: { id: USER_ID } });
      await db.insert(user).values({ id: USER_ID, name: 'E2E User', email: `${USER_ID}@example.com` });
      const { list, items } = await seedList();
      const [item] = items;
      if (!item) throw new Error('expected an item to be created');

      const res = await client.api.v1.users.me['vocabulary-lists'][':userVocabularyListId'].items[
        ':userVocabularyItemId'
      ].discover.$post({
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
      ].discover.$post({
        param: { userVocabularyListId: runUserList.id, userVocabularyItemId: walkUserItem.id },
        json: { status: LearningStatus.Known, durationMs: 1234 },
      });
      expect(res.status).toBe(404);
    });

    it('returns 409 without recording another event when the item has already been discovered', async () => {
      auth.authorized({ user: { id: USER_ID } });
      await db.insert(user).values({ id: USER_ID, name: 'E2E User', email: `${USER_ID}@example.com` });
      const { userList, userItems } = await addList();
      const [userItem] = userItems;
      if (!userItem) throw new Error('expected a user item to be created');

      const discover = () =>
        client.api.v1.users.me['vocabulary-lists'][':userVocabularyListId'].items[
          ':userVocabularyItemId'
        ].discover.$post({
          param: { userVocabularyListId: userList.id, userVocabularyItemId: userItem.id },
          json: { status: LearningStatus.Known, durationMs: 1234 },
        });

      expect((await discover()).status).toBe(200);
      expect((await discover()).status).toBe(409);

      const events = await db.query.event.findMany({ where: eq(event.userVocabularyItemId, userItem.id) });
      expect(events).toHaveLength(1);
    });
  });

  describe('POST /api/v1/users/me/vocabulary-lists/:userVocabularyListId/items/:userVocabularyItemId/undo', () => {
    const addList = async (values: string[] = ['run'], title = 'Oxford 5000 A1') => {
      const { list, items } = await seedList(values, title);
      const postRes = await client.api.v1.users.me['vocabulary-lists'].$post({ json: { vocabularyListId: list.id } });
      const { data: userList } = await postRes.json();

      const userItems = await db.query.userVocabularyItem.findMany({
        where: eq(userVocabularyItem.userId, USER_ID),
      });

      return { list, items, userList, userItems };
    };

    it('reverts status to waiting, marks the discovered event as reverted, and records an undone event', async () => {
      auth.authorized({ user: { id: USER_ID } });
      await db.insert(user).values({ id: USER_ID, name: 'E2E User', email: `${USER_ID}@example.com` });
      const { userList, userItems } = await addList();
      const [userItem] = userItems;
      if (!userItem) throw new Error('expected a user item to be created');

      await client.api.v1.users.me['vocabulary-lists'][':userVocabularyListId'].items[
        ':userVocabularyItemId'
      ].discover.$post({
        param: { userVocabularyListId: userList.id, userVocabularyItemId: userItem.id },
        json: { status: LearningStatus.Known, durationMs: 1234 },
      });

      const res = await client.api.v1.users.me['vocabulary-lists'][':userVocabularyListId'].items[
        ':userVocabularyItemId'
      ].undo.$post({
        param: { userVocabularyListId: userList.id, userVocabularyItemId: userItem.id },
      });
      expect(res.status).toBe(200);

      const body = await res.json();
      expect(body).toMatchObject({
        success: true,
        data: {
          id: userItem.id,
          status: LearningStatus.Waiting,
          encounterCount: 0,
          vocabularyItem: { value: 'run' },
        },
      });

      const updated = await db.query.userVocabularyItem.findFirst({ where: eq(userVocabularyItem.id, userItem.id) });
      expect(updated?.status).toBe(LearningStatus.Waiting);

      const events = await db.query.event.findMany({
        where: eq(event.userVocabularyItemId, userItem.id),
        orderBy: (event, { asc }) => asc(event.createdAt),
      });
      expect(events).toMatchObject([
        { type: EventType.UserVocabularyItemDiscovered, revertedAt: expect.any(Date) },
        {
          type: EventType.UserVocabularyItemDiscoveryUndone,
          status: LearningStatus.Known,
          encounterCount: 0,
          durationMs: 1234,
          revertedAt: null,
        },
      ]);
    });

    it('clears accumulated learning progress', async () => {
      auth.authorized({ user: { id: USER_ID } });
      await db.insert(user).values({ id: USER_ID, name: 'E2E User', email: `${USER_ID}@example.com` });
      const { userList, userItems } = await addList();
      const [userItem] = userItems;
      if (!userItem) throw new Error('expected a user item to be created');

      await client.api.v1.users.me['vocabulary-lists'][':userVocabularyListId'].items[
        ':userVocabularyItemId'
      ].discover.$post({
        param: { userVocabularyListId: userList.id, userVocabularyItemId: userItem.id },
        json: { status: LearningStatus.Learning, durationMs: 1234 },
      });

      const moveToNextStep = () =>
        client.api.v1.users.me['vocabulary-lists'][':userVocabularyListId'].items[':userVocabularyItemId'][
          'move-to-next-step'
        ].$post({ param: { userVocabularyListId: userList.id, userVocabularyItemId: userItem.id } });
      await moveToNextStep();
      await moveToNextStep();

      const res = await client.api.v1.users.me['vocabulary-lists'][':userVocabularyListId'].items[
        ':userVocabularyItemId'
      ].undo.$post({
        param: { userVocabularyListId: userList.id, userVocabularyItemId: userItem.id },
      });

      expect(res.status).toBe(200);
      await expect(res.json()).resolves.toMatchObject({
        success: true,
        data: { id: userItem.id, status: LearningStatus.Waiting, encounterCount: 0 },
      });

      const updated = await db.query.userVocabularyItem.findFirst({ where: eq(userVocabularyItem.id, userItem.id) });
      expect(updated).toMatchObject({ status: LearningStatus.Waiting, encounterCount: 0, enqueuedAt: null });
    });

    it('returns 409 when the item is already waiting', async () => {
      auth.authorized({ user: { id: USER_ID } });
      await db.insert(user).values({ id: USER_ID, name: 'E2E User', email: `${USER_ID}@example.com` });
      const { userList, userItems } = await addList();
      const [userItem] = userItems;
      if (!userItem) throw new Error('expected a user item to be created');

      const res = await client.api.v1.users.me['vocabulary-lists'][':userVocabularyListId'].items[
        ':userVocabularyItemId'
      ].undo.$post({
        param: { userVocabularyListId: userList.id, userVocabularyItemId: userItem.id },
      });
      expect(res.status).toBe(409);
    });

    it('returns 401 Unauthorized when not authenticated', async () => {
      auth.unauthorized();
      const { list, items } = await seedList();
      const [item] = items;
      if (!item) throw new Error('expected an item to be created');

      const res = await client.api.v1.users.me['vocabulary-lists'][':userVocabularyListId'].items[
        ':userVocabularyItemId'
      ].undo.$post({
        param: { userVocabularyListId: list.id, userVocabularyItemId: item.id },
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
      ].undo.$post({
        param: { userVocabularyListId: list.id, userVocabularyItemId: item.id },
      });
      expect(res.status).toBe(404);
    });
  });

  describe('POST /api/v1/users/me/vocabulary-lists/:userVocabularyListId/items/:userVocabularyItemId/reset', () => {
    const addList = async (values: string[] = ['run'], title = 'Oxford 5000 A1') => {
      const { list, items } = await seedList(values, title);
      const postRes = await client.api.v1.users.me['vocabulary-lists'].$post({ json: { vocabularyListId: list.id } });
      const { data: userList } = await postRes.json();

      const userItems = await db.query.userVocabularyItem.findMany({
        where: eq(userVocabularyItem.userId, USER_ID),
      });

      return { list, items, userList, userItems };
    };

    it('reverts status to waiting, leaves the discovered event untouched, and records a progress-reset event', async () => {
      auth.authorized({ user: { id: USER_ID } });
      await db.insert(user).values({ id: USER_ID, name: 'E2E User', email: `${USER_ID}@example.com` });
      const { userList, userItems } = await addList();
      const [userItem] = userItems;
      if (!userItem) throw new Error('expected a user item to be created');

      await client.api.v1.users.me['vocabulary-lists'][':userVocabularyListId'].items[
        ':userVocabularyItemId'
      ].discover.$post({
        param: { userVocabularyListId: userList.id, userVocabularyItemId: userItem.id },
        json: { status: LearningStatus.Known, durationMs: 1234 },
      });

      const res = await client.api.v1.users.me['vocabulary-lists'][':userVocabularyListId'].items[
        ':userVocabularyItemId'
      ].reset.$post({
        param: { userVocabularyListId: userList.id, userVocabularyItemId: userItem.id },
      });
      expect(res.status).toBe(200);

      const body = await res.json();
      expect(body).toMatchObject({
        success: true,
        data: {
          id: userItem.id,
          status: LearningStatus.Waiting,
          encounterCount: 0,
          vocabularyItem: { value: 'run' },
        },
      });

      const updated = await db.query.userVocabularyItem.findFirst({ where: eq(userVocabularyItem.id, userItem.id) });
      expect(updated?.status).toBe(LearningStatus.Waiting);

      const events = await db.query.event.findMany({
        where: eq(event.userVocabularyItemId, userItem.id),
        orderBy: (event, { asc }) => asc(event.createdAt),
      });
      expect(events).toMatchObject([
        { type: EventType.UserVocabularyItemDiscovered, revertedAt: null },
        {
          type: EventType.UserVocabularyItemProgressReset,
          status: LearningStatus.Known,
          encounterCount: 0,
          revertedAt: null,
        },
      ]);
    });

    it('returns 409 when the item is already waiting', async () => {
      auth.authorized({ user: { id: USER_ID } });
      await db.insert(user).values({ id: USER_ID, name: 'E2E User', email: `${USER_ID}@example.com` });
      const { userList, userItems } = await addList();
      const [userItem] = userItems;
      if (!userItem) throw new Error('expected a user item to be created');

      const res = await client.api.v1.users.me['vocabulary-lists'][':userVocabularyListId'].items[
        ':userVocabularyItemId'
      ].reset.$post({
        param: { userVocabularyListId: userList.id, userVocabularyItemId: userItem.id },
      });
      expect(res.status).toBe(409);
    });

    it('returns 401 Unauthorized when not authenticated', async () => {
      auth.unauthorized();
      const { list, items } = await seedList();
      const [item] = items;
      if (!item) throw new Error('expected an item to be created');

      const res = await client.api.v1.users.me['vocabulary-lists'][':userVocabularyListId'].items[
        ':userVocabularyItemId'
      ].reset.$post({
        param: { userVocabularyListId: list.id, userVocabularyItemId: item.id },
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
      ].reset.$post({
        param: { userVocabularyListId: list.id, userVocabularyItemId: item.id },
      });
      expect(res.status).toBe(404);
    });
  });

  describe('POST /api/v1/users/me/vocabulary-lists/:userVocabularyListId/items/:userVocabularyItemId/move-to-next-step', () => {
    const addLearningItem = async (values: string[] = ['run'], title = 'Oxford 5000 A1') => {
      const { list, items } = await seedList(values, title);
      const postRes = await client.api.v1.users.me['vocabulary-lists'].$post({ json: { vocabularyListId: list.id } });
      const { data: userList } = await postRes.json();

      const userItems = await db.query.userVocabularyItem.findMany({
        where: eq(userVocabularyItem.userId, USER_ID),
      });
      const [userItem] = userItems;
      if (!userItem) throw new Error('expected a user item to be created');

      await client.api.v1.users.me['vocabulary-lists'][':userVocabularyListId'].items[
        ':userVocabularyItemId'
      ].discover.$post({
        param: { userVocabularyListId: userList.id, userVocabularyItemId: userItem.id },
        json: { status: LearningStatus.Learning, durationMs: 0 },
      });

      return { list, items, userList, userItems };
    };

    it('increments encounterCount, records a moved-to-next-step event, and re-enqueues the item', async () => {
      auth.authorized({ user: { id: USER_ID } });
      await db.insert(user).values({ id: USER_ID, name: 'E2E User', email: `${USER_ID}@example.com` });
      const { userList, userItems } = await addLearningItem();
      const [userItem] = userItems;
      if (!userItem) throw new Error('expected a user item to be created');

      const res = await client.api.v1.users.me['vocabulary-lists'][':userVocabularyListId'].items[
        ':userVocabularyItemId'
      ]['move-to-next-step'].$post({
        param: { userVocabularyListId: userList.id, userVocabularyItemId: userItem.id },
      });
      expect(res.status).toBe(200);

      const body = await res.json();
      expect(body).toMatchObject({
        success: true,
        data: {
          id: userItem.id,
          userId: USER_ID,
          vocabularyItemId: userItem.vocabularyItemId,
          status: LearningStatus.Learning,
          encounterCount: 1,
          vocabularyItem: { id: userItem.vocabularyItemId },
        },
      });

      const updated = await db.query.userVocabularyItem.findFirst({ where: eq(userVocabularyItem.id, userItem.id) });
      expect(updated?.status).toBe(LearningStatus.Learning);
      expect(updated?.encounterCount).toBe(1);
      expect(updated?.enqueuedAt).not.toBeNull();

      const events = await db.query.event.findMany({
        where: and(
          eq(event.userVocabularyItemId, userItem.id),
          eq(event.type, EventType.UserVocabularyItemMovedToNextStep),
        ),
      });
      expect(events).toMatchObject([{ userId: USER_ID, status: LearningStatus.Learning, encounterCount: 1 }]);
    });

    it('graduates the item to learned once it reaches the confirmation threshold', async () => {
      auth.authorized({ user: { id: USER_ID } });
      await db.insert(user).values({ id: USER_ID, name: 'E2E User', email: `${USER_ID}@example.com` });
      const { userList, userItems } = await addLearningItem();
      const [userItem] = userItems;
      if (!userItem) throw new Error('expected a user item to be created');

      const call = () =>
        client.api.v1.users.me['vocabulary-lists'][':userVocabularyListId'].items[':userVocabularyItemId'][
          'move-to-next-step'
        ].$post({
          param: { userVocabularyListId: userList.id, userVocabularyItemId: userItem.id },
        });

      await call();
      await call();
      const res = await call();
      expect(res.status).toBe(200);

      const body = await res.json();
      expect(body).toMatchObject({
        success: true,
        data: {
          id: userItem.id,
          userId: USER_ID,
          vocabularyItemId: userItem.vocabularyItemId,
          status: LearningStatus.Learned,
          encounterCount: 3,
          vocabularyItem: { id: userItem.vocabularyItemId },
        },
      });

      const updated = await db.query.userVocabularyItem.findFirst({ where: eq(userVocabularyItem.id, userItem.id) });
      expect(updated?.status).toBe(LearningStatus.Learned);
      expect(updated?.encounterCount).toBe(3);
      expect(updated?.enqueuedAt).toBeNull();
    });

    it('returns 409 when the item is not in learning status', async () => {
      auth.authorized({ user: { id: USER_ID } });
      await db.insert(user).values({ id: USER_ID, name: 'E2E User', email: `${USER_ID}@example.com` });
      const { list } = await seedList();
      const postRes = await client.api.v1.users.me['vocabulary-lists'].$post({ json: { vocabularyListId: list.id } });
      const { data: userList } = await postRes.json();
      const userItems = await db.query.userVocabularyItem.findMany({
        where: eq(userVocabularyItem.userId, USER_ID),
      });
      const [userItem] = userItems;
      if (!userItem) throw new Error('expected a user item to be created');

      const res = await client.api.v1.users.me['vocabulary-lists'][':userVocabularyListId'].items[
        ':userVocabularyItemId'
      ]['move-to-next-step'].$post({
        param: { userVocabularyListId: userList.id, userVocabularyItemId: userItem.id },
      });
      expect(res.status).toBe(409);
    });

    it('returns 401 Unauthorized when not authenticated', async () => {
      auth.unauthorized();
      const { list, items } = await seedList();
      const [item] = items;
      if (!item) throw new Error('expected an item to be created');

      const res = await client.api.v1.users.me['vocabulary-lists'][':userVocabularyListId'].items[
        ':userVocabularyItemId'
      ]['move-to-next-step'].$post({
        param: { userVocabularyListId: list.id, userVocabularyItemId: item.id },
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
      ]['move-to-next-step'].$post({
        param: { userVocabularyListId: list.id, userVocabularyItemId: item.id },
      });
      expect(res.status).toBe(404);
    });
  });

  describe('POST /api/v1/users/me/vocabulary-lists/:userVocabularyListId/learn/events', () => {
    const addList = async (values: string[] = ['run'], title = 'Oxford 5000 A1') => {
      const { list, items } = await seedList(values, title);
      const postRes = await client.api.v1.users.me['vocabulary-lists'].$post({ json: { vocabularyListId: list.id } });
      const { data: userList } = await postRes.json();

      const userItems = await db.query.userVocabularyItem.findMany({
        where: eq(userVocabularyItem.userId, USER_ID),
      });

      return { items, userList, userItems };
    };

    it('returns 201 and creates every supported client Learn event', async () => {
      auth.authorized({ user: { id: USER_ID } });
      await db.insert(user).values({ id: USER_ID, name: 'E2E User', email: `${USER_ID}@example.com` });
      const { userList, userItems } = await addList();
      const [userItem] = userItems;
      if (!userItem) throw new Error('expected a user item to be created');

      const res = await client.api.v1.users.me['vocabulary-lists'][':userVocabularyListId'].learn.events.$post({
        param: { userVocabularyListId: userList.id },
        json: {
          events: [
            {
              type: EventType.UserVocabularyItemTaskFailed,
              userVocabularyItemId: userItem.id,
              userVocabularyItemTaskType: UserVocabularyItemTaskType.VocabularyItemToDefinition,
            },
            {
              type: EventType.UserVocabularyItemTaskPassed,
              userVocabularyItemId: userItem.id,
              userVocabularyItemTaskType: UserVocabularyItemTaskType.DefinitionToVocabularyItem,
              durationMs: 100,
            },
            {
              type: EventType.UserVocabularyItemTaskRetryPassed,
              userVocabularyItemId: userItem.id,
              userVocabularyItemTaskType: UserVocabularyItemTaskType.VocabularyItemToTranslation,
              durationMs: 200,
            },
            {
              type: EventType.UserVocabularyItemTaskShowcaseViewed,
              userVocabularyItemId: userItem.id,
              durationMs: 300,
            },
            {
              type: EventType.UserVocabularyItemTaskHintUsed,
              userVocabularyItemId: userItem.id,
              userVocabularyItemTaskType: UserVocabularyItemTaskType.TranslationToVocabularyItem,
            },
          ],
        },
      });

      expect(res.status).toBe(201);
      const body = await res.json();
      expect(body.success).toBe(true);
      expect(body.data).toHaveLength(5);
      expect(body.data).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            type: EventType.UserVocabularyItemTaskFailed,
            userId: USER_ID,
            userVocabularyItemId: userItem.id,
            userVocabularyListId: userList.id,
          }),
        ]),
      );

      const events = await db.query.event.findMany({ where: eq(event.userVocabularyItemId, userItem.id) });
      expect(events).toHaveLength(5);
      expect(events).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            type: EventType.UserVocabularyItemTaskFailed,
            userId: USER_ID,
            userVocabularyListId: userList.id,
            userVocabularyItemTaskType: UserVocabularyItemTaskType.VocabularyItemToDefinition,
          }),
          expect.objectContaining({
            type: EventType.UserVocabularyItemTaskPassed,
            durationMs: 100,
            userVocabularyItemTaskType: UserVocabularyItemTaskType.DefinitionToVocabularyItem,
          }),
          expect.objectContaining({
            type: EventType.UserVocabularyItemTaskRetryPassed,
            durationMs: 200,
            userVocabularyItemTaskType: UserVocabularyItemTaskType.VocabularyItemToTranslation,
          }),
          expect.objectContaining({
            type: EventType.UserVocabularyItemTaskShowcaseViewed,
            durationMs: 300,
            userVocabularyItemTaskType: null,
          }),
          expect.objectContaining({
            type: EventType.UserVocabularyItemTaskHintUsed,
            userVocabularyItemTaskType: UserVocabularyItemTaskType.TranslationToVocabularyItem,
          }),
        ]),
      );
    });

    it('returns 401 when not authenticated', async () => {
      auth.unauthorized();

      const res = await client.api.v1.users.me['vocabulary-lists'][':userVocabularyListId'].learn.events.$post({
        param: { userVocabularyListId: '00000000-0000-7000-8000-000000000000' },
        json: {
          events: [
            {
              type: EventType.UserVocabularyItemTaskFailed,
              userVocabularyItemId: '00000000-0000-7000-8000-000000000001',
              userVocabularyItemTaskType: UserVocabularyItemTaskType.VocabularyItemToDefinition,
            },
          ],
        },
      });

      expect(res.status).toBe(401);
    });

    it('rejects the complete batch when an item does not belong to the route list', async () => {
      auth.authorized({ user: { id: USER_ID } });
      await db.insert(user).values({ id: USER_ID, name: 'E2E User', email: `${USER_ID}@example.com` });
      const first = await addList(['run'], 'Oxford 5000 A1');
      const second = await addList(['walk'], 'Oxford 5000 A2');
      const firstVocabularyItemId = first.items[0]?.id;
      const secondVocabularyItemId = second.items[0]?.id;
      const firstUserItem = second.userItems.find((item) => item.vocabularyItemId === firstVocabularyItemId);
      const secondUserItem = second.userItems.find((item) => item.vocabularyItemId === secondVocabularyItemId);
      if (!firstUserItem || !secondUserItem) throw new Error('expected user items to be created');

      const res = await client.api.v1.users.me['vocabulary-lists'][':userVocabularyListId'].learn.events.$post({
        param: { userVocabularyListId: first.userList.id },
        json: {
          events: [
            {
              type: EventType.UserVocabularyItemTaskFailed,
              userVocabularyItemId: firstUserItem.id,
              userVocabularyItemTaskType: UserVocabularyItemTaskType.VocabularyItemToDefinition,
            },
            {
              type: EventType.UserVocabularyItemTaskHintUsed,
              userVocabularyItemId: secondUserItem.id,
              userVocabularyItemTaskType: UserVocabularyItemTaskType.VocabularyItemToDefinition,
            },
          ],
        },
      });

      expect(res.status).toBe(404);
      expect(await countItems(event)).toBe(0);
    });

    it('rejects server-owned event types', async () => {
      auth.authorized({ user: { id: USER_ID } });
      await db.insert(user).values({ id: USER_ID, name: 'E2E User', email: `${USER_ID}@example.com` });
      const { userList, userItems } = await addList();
      const [userItem] = userItems;
      if (!userItem) throw new Error('expected a user item to be created');

      for (const type of [EventType.UserVocabularyItemDiscovered, EventType.UserVocabularyItemMovedToNextStep]) {
        const res = await client.api.v1.users.me['vocabulary-lists'][':userVocabularyListId'].learn.events.$post({
          param: { userVocabularyListId: userList.id },
          json: { events: [{ type, userVocabularyItemId: userItem.id }] } as never,
        });

        expect(res.status).toBe(400);
      }

      expect(await countItems(event)).toBe(0);
    });

    it('rejects invalid client event batches', async () => {
      auth.authorized({ user: { id: USER_ID } });
      await db.insert(user).values({ id: USER_ID, name: 'E2E User', email: `${USER_ID}@example.com` });
      const { userList, userItems } = await addList();
      const [userItem] = userItems;
      if (!userItem) throw new Error('expected a user item to be created');

      const invalidBodies = [
        { events: [] },
        {
          events: [
            {
              type: EventType.UserVocabularyItemTaskFailed,
              userVocabularyItemId: 'not-a-uuid',
              userVocabularyItemTaskType: UserVocabularyItemTaskType.VocabularyItemToDefinition,
            },
          ],
        },
        {
          events: [
            {
              type: EventType.UserVocabularyItemTaskPassed,
              userVocabularyItemId: userItem.id,
              userVocabularyItemTaskType: UserVocabularyItemTaskType.VocabularyItemToDefinition,
              durationMs: -1,
            },
          ],
        },
        {
          events: [
            {
              type: EventType.UserVocabularyItemTaskPassed,
              userVocabularyItemId: userItem.id,
              userVocabularyItemTaskType: UserVocabularyItemTaskType.VocabularyItemToDefinition,
              durationMs: 1.5,
            },
          ],
        },
        {
          events: [
            {
              type: EventType.UserVocabularyItemTaskHintUsed,
              userVocabularyItemId: userItem.id,
              userVocabularyItemTaskType: 'invalid-task-type',
            },
          ],
        },
        {
          events: Array.from({ length: 21 }, () => ({
            type: EventType.UserVocabularyItemTaskHintUsed,
            userVocabularyItemId: userItem.id,
            userVocabularyItemTaskType: UserVocabularyItemTaskType.VocabularyItemToDefinition,
          })),
        },
      ];

      for (const json of invalidBodies) {
        const res = await client.api.v1.users.me['vocabulary-lists'][':userVocabularyListId'].learn.events.$post({
          param: { userVocabularyListId: userList.id },
          json: json as never,
        });

        expect(res.status).toBe(400);
      }

      expect(await countItems(event)).toBe(0);
    });
  });

  describe('PATCH /api/v1/users/me/vocabulary-lists/:userVocabularyListId/items/:userVocabularyItemId/translation', () => {
    const addList = async (values: string[] = ['run'], title = 'Oxford 5000 A1') => {
      const { list, items } = await seedList(values, title);
      const postRes = await client.api.v1.users.me['vocabulary-lists'].$post({ json: { vocabularyListId: list.id } });
      const { data: userList } = await postRes.json();

      const userItems = await db.query.userVocabularyItem.findMany({
        where: eq(userVocabularyItem.userId, USER_ID),
      });

      return { list, items, userList, userItems };
    };

    it('returns 200, updates the shared vocabulary item, and records an update event', async () => {
      auth.authorized({ user: { id: USER_ID } });
      await db.insert(user).values({ id: USER_ID, name: 'E2E User', email: `${USER_ID}@example.com` });
      const { userList, userItems, items } = await addList();
      const [userItem] = userItems;
      const [item] = items;
      if (!userItem || !item) throw new Error('expected a user item to be created');

      const res = await client.api.v1.users.me['vocabulary-lists'][':userVocabularyListId'].items[
        ':userVocabularyItemId'
      ].translation.$patch({
        param: { userVocabularyListId: userList.id, userVocabularyItemId: userItem.id },
        json: { uaTranslation: 'бігти' },
      });
      expect(res.status).toBe(200);

      const body = await res.json();
      expect(body).toMatchObject({
        success: true,
        data: {
          id: userItem.id,
          userId: USER_ID,
          vocabularyItemId: userItem.vocabularyItemId,
          vocabularyItem: { id: item.id, uaTranslation: 'бігти' },
        },
      });

      const updated = await db.query.vocabularyItem.findFirst({ where: eq(vocabularyItem.id, item.id) });
      expect(updated?.uaTranslation).toBe('бігти');

      const events = await db.query.event.findMany({ where: eq(event.userVocabularyItemId, userItem.id) });
      expect(events).toMatchObject([
        {
          type: EventType.VocabularyItemUpdated,
          userId: USER_ID,
          userVocabularyItemId: userItem.id,
          vocabularyItemId: item.id,
          userVocabularyListId: userList.id,
          fieldName: 'uaTranslation',
        },
      ]);
    });

    it('returns 401 Unauthorized when not authenticated', async () => {
      auth.unauthorized();
      const { list, items } = await seedList();
      const [item] = items;
      if (!item) throw new Error('expected an item to be created');

      const res = await client.api.v1.users.me['vocabulary-lists'][':userVocabularyListId'].items[
        ':userVocabularyItemId'
      ].translation.$patch({
        param: { userVocabularyListId: list.id, userVocabularyItemId: item.id },
        json: { uaTranslation: 'бігти' },
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
      ].translation.$patch({
        param: { userVocabularyListId: list.id, userVocabularyItemId: item.id },
        json: { uaTranslation: 'бігти' },
      });
      expect(res.status).toBe(404);
    });

    it('returns 400 when uaTranslation is blank', async () => {
      auth.authorized({ user: { id: USER_ID } });
      await db.insert(user).values({ id: USER_ID, name: 'E2E User', email: `${USER_ID}@example.com` });
      const { userList, userItems } = await addList();
      const [userItem] = userItems;
      if (!userItem) throw new Error('expected a user item to be created');

      const res = await client.api.v1.users.me['vocabulary-lists'][':userVocabularyListId'].items[
        ':userVocabularyItemId'
      ].translation.$patch({
        param: { userVocabularyListId: userList.id, userVocabularyItemId: userItem.id },
        json: { uaTranslation: '  ' },
      });
      expect(res.status).toBe(400);
    });
  });
});
