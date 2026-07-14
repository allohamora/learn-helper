import '@tanstack/react-start/server-only';
import { EventType } from '@/const/event';
import { LearningStatus } from '@/const/vocabulary';
import { updateVocabularyItemTranslation } from '../vocabulary/vocabulary-item.repository';
import { db } from '../db/db.service';
import { deleteUserVocabularyItemDiscoveredEvents, insertEvent } from '../event/event.repository';
import type { SetUserVocabularyItemStatusDto } from './dto/set-user-vocabulary-item-status.dto';
import type { UpdateUserVocabularyItemTranslationDto } from './dto/update-user-vocabulary-item-translation.dto';
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

export const updateUserVocabularyItemTranslation = async ({
  userId,
  userVocabularyListId,
  userVocabularyItemId,
  uaTranslation,
}: {
  userId: string;
  userVocabularyListId: string;
  userVocabularyItemId: string;
} & UpdateUserVocabularyItemTranslationDto) => {
  return db.transaction(async (tx) => {
    const { vocabularyItemId } = await getUserVocabularyListItemLinkOrThrow(
      { userId, userVocabularyListId, userVocabularyItemId },
      tx,
    );

    await updateVocabularyItemTranslation({ vocabularyItemId, uaTranslation }, tx);
    await insertEvent(
      {
        type: EventType.VocabularyItemUpdated,
        userId,
        userVocabularyItemId,
        vocabularyItemId,
        userVocabularyListId,
        fieldName: 'uaTranslation',
      },
      tx,
    );

    return { userVocabularyItemId, uaTranslation };
  });
};
