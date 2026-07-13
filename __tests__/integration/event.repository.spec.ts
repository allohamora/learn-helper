import { eq } from 'drizzle-orm';
import { describe, expect, it } from 'vitest';
import { db } from '@/server/db/db.service';
import { event, user, userVocabularyItem } from '@/server/db/db.schema';
import { createMissingVocabularyItems } from '@/server/vocabulary/vocabulary-item.repository';
import { createVocabularyListItemsIfNotExist } from '@/server/vocabulary/vocabulary-list-item.repository';
import { findOrCreateVocabularyListByTitle } from '@/server/vocabulary/vocabulary-list.repository';
import { createUserVocabularyItemsFromList } from '@/server/user-vocabulary/user-vocabulary-item.repository';
import { createUserVocabularyList } from '@/server/user-vocabulary/user-vocabulary-list.repository';
import { deleteUserVocabularyItemDiscoveredEvents, insertEvent } from '@/server/event/event.repository';
import { EventType } from '@/const/event';
import { LearningStatus, PartOfSpeech } from '@/const/vocabulary';

const USER_ID = 'user-1';

const seed = async () => {
  await db.insert(user).values({ id: USER_ID, name: 'Test User', email: `${USER_ID}@example.com` });

  const list = await findOrCreateVocabularyListByTitle('Oxford 5000 A1');
  const [item] = await createMissingVocabularyItems([
    {
      value: 'run',
      definition: 'to move fast on foot',
      uaTranslation: 'бігти',
      partOfSpeech: PartOfSpeech.Verb,
      spelling: '/rʌn/',
    },
  ]);
  if (!item) throw new Error('expected item to be created');

  await createVocabularyListItemsIfNotExist([{ vocabularyListId: list.id, vocabularyItemId: item.id }]);
  await createUserVocabularyItemsFromList({ userId: USER_ID, vocabularyListId: list.id });
  const userList = await createUserVocabularyList({ userId: USER_ID, vocabularyListId: list.id });
  if (!userList) throw new Error('expected user list to be created');

  const userItem = await db.query.userVocabularyItem.findFirst({ where: eq(userVocabularyItem.userId, USER_ID) });
  if (!userItem) throw new Error('expected user item to be created');

  return { userList, userItem };
};

describe('eventRepository', () => {
  describe('insertEvent', () => {
    it('inserts a discovered event row', async () => {
      const { userList, userItem } = await seed();

      await insertEvent({
        type: EventType.UserVocabularyItemDiscovered,
        userId: USER_ID,
        userVocabularyItemId: userItem.id,
        userVocabularyListId: userList.id,
        status: LearningStatus.Known,
        durationMs: 4321,
      });

      const events = await db.query.event.findMany({ where: eq(event.userVocabularyItemId, userItem.id) });
      expect(events).toMatchObject([
        {
          type: EventType.UserVocabularyItemDiscovered,
          userId: USER_ID,
          userVocabularyItemId: userItem.id,
          userVocabularyListId: userList.id,
          status: LearningStatus.Known,
          durationMs: 4321,
        },
      ]);
    });
  });

  describe('deleteUserVocabularyItemDiscoveredEvents', () => {
    it('deletes only the discovered event for the given user and item', async () => {
      const { userList, userItem } = await seed();

      await insertEvent({
        type: EventType.UserVocabularyItemDiscovered,
        userId: USER_ID,
        userVocabularyItemId: userItem.id,
        userVocabularyListId: userList.id,
        status: LearningStatus.Known,
        durationMs: 100,
      });
      await insertEvent({
        type: EventType.UserVocabularyItemMovedToNextStep,
        userId: USER_ID,
        userVocabularyItemId: userItem.id,
      });

      await deleteUserVocabularyItemDiscoveredEvents({ userId: USER_ID, userVocabularyItemId: userItem.id });

      const events = await db.query.event.findMany({ where: eq(event.userVocabularyItemId, userItem.id) });
      expect(events).toMatchObject([{ type: EventType.UserVocabularyItemMovedToNextStep }]);
    });
  });
});
