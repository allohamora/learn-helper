import '@tanstack/react-start/server-only';
import { EventType } from '@/const/event';
import { LearningStatus } from '@/const/vocabulary';
import { db } from '../db/db.service';
import { deleteUserVocabularyItemDiscoveredEvents, insertEvent } from '../event/event.repository';
import type { SetUserVocabularyItemStatusDto } from './dto/set-user-vocabulary-item-status.dto';
import {
  getUserVocabularyListItemLinkOrThrow,
  updateUserVocabularyItemStatus,
} from './user-vocabulary-item.repository';

export const setUserVocabularyItemStatus = async ({
  userId,
  userVocabularyListId,
  userVocabularyItemId,
  ...body
}: {
  userId: string;
  userVocabularyListId: string;
  userVocabularyItemId: string;
} & SetUserVocabularyItemStatusDto) => {
  return db.transaction(async (tx) => {
    await getUserVocabularyListItemLinkOrThrow({ userId, userVocabularyListId, userVocabularyItemId }, tx);

    if (body.status === LearningStatus.Waiting) {
      await deleteUserVocabularyItemDiscoveredEvents({ userId, userVocabularyItemId }, tx);
    } else {
      await insertEvent(
        {
          type: EventType.UserVocabularyItemDiscovered,
          userId,
          userVocabularyItemId,
          userVocabularyListId,
          status: body.status,
          durationMs: body.durationMs,
        },
        tx,
      );
    }

    await updateUserVocabularyItemStatus({ userId, userVocabularyItemId, status: body.status }, tx);

    return { userVocabularyItemId, status: body.status };
  });
};
