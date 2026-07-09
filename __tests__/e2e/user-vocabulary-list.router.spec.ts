import { describe, expect, it } from 'vitest';
import { client } from '../setup-e2e-context';
import { auth } from '../mocks/auth.middleware.mock';
import { db } from '@/server/db/db.service';
import { PartOfSpeech, user, userVocabularyItem } from '@/server/db/db.schema';
import { countItems } from '@/server/db/db.utils';
import { createMissingVocabularyItems } from '@/server/vocabulary/vocabulary-item.repository';
import { createVocabularyListItemsIfNotExist } from '@/server/vocabulary/vocabulary-list-item.repository';
import { findOrCreateVocabularyListByTitle } from '@/server/vocabulary/vocabulary-list.repository';

const USER_ID = 'e2e-test-user';

const seedList = async () => {
  const list = await findOrCreateVocabularyListByTitle('Oxford 5000 A1');
  const items = await createMissingVocabularyItems([
    {
      value: 'run',
      definition: 'to move fast on foot',
      uaTranslation: 'бігти',
      partOfSpeech: PartOfSpeech.Verb,
      spelling: '/rʌn/',
    },
  ]);
  await createVocabularyListItemsIfNotExist(
    items.map((item) => ({ vocabularyListId: list.id, vocabularyItemId: item.id })),
  );

  return list;
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
      const list = await seedList();
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
      const list = await seedList();

      const res = await client.api.v1.users.me['vocabulary-lists'].$post({ json: { id: list.id } });
      expect(res.status).toBe(200);

      expect(await countItems(userVocabularyItem)).toBe(1);
    });

    it('returns 401 Unauthorized when not authenticated', async () => {
      auth.unauthorized();
      const list = await seedList();

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
});
