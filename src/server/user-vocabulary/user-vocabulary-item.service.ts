import '@tanstack/react-start/server-only';
import { EventType } from '@/const/event';
import { LearningStatus } from '@/const/vocabulary';
import { updateVocabularyItemTranslation } from '../vocabulary/vocabulary-item.repository';
import { db } from '../db/db.service';
import { insertEvent, revertUserVocabularyItemDiscoveredEvent } from '../event/event.repository';
import { Exception } from '../utils/exception.utils';
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

    await updateUserVocabularyItemStatus({ userId, userVocabularyItemId, status: body.status }, tx);

    return { userVocabularyItemId, status: body.status };
  });
};

export const undoUserVocabularyItemStatus = async ({
  userId,
  userVocabularyListId,
  userVocabularyItemId,
}: {
  userId: string;
  userVocabularyListId: string;
  userVocabularyItemId: string;
}) => {
  return db.transaction(async (tx) => {
    await getUserVocabularyListItemLinkOrThrow({ userId, userVocabularyListId, userVocabularyItemId }, tx);

    const revertedEvent = await revertUserVocabularyItemDiscoveredEvent({ userId, userVocabularyItemId }, tx);
    if (!revertedEvent) {
      throw Exception.notFound(`no active discovery event for user vocabulary item "${userVocabularyItemId}"`);
    }

    await insertEvent(
      {
        type: EventType.UserVocabularyItemDiscoveryUndone,
        userId,
        userVocabularyItemId,
        userVocabularyListId,
        durationMs: revertedEvent.durationMs,
      },
      tx,
    );

    await updateUserVocabularyItemStatus({ userId, userVocabularyItemId, status: LearningStatus.Waiting }, tx);

    return { userVocabularyItemId, status: LearningStatus.Waiting };
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
