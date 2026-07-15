import '@tanstack/react-start/server-only';
import { EventType } from '@/const/event';
import { LearningStatus } from '@/const/vocabulary';
import { updateVocabularyItemTranslation } from '../vocabulary/vocabulary-item.repository';
import { db } from '../db/db.service';
import type { Transaction } from '../db/db.types';
import { insertEvent, revertUserVocabularyItemDiscoveredEvent } from '../event/event.repository';
import { Exception } from '../utils/exception.utils';
import type { SetUserVocabularyItemStatusDto } from './dto/set-user-vocabulary-item-status.dto';
import type { UpdateUserVocabularyItemTranslationDto } from './dto/update-user-vocabulary-item-translation.dto';
import { getUserVocabularyListItemLink, updateUserVocabularyItemStatus } from './user-vocabulary-item.repository';

const getUserVocabularyListItemLinkOrThrow = async (
  {
    userId,
    userVocabularyListId,
    userVocabularyItemId,
  }: { userId: string; userVocabularyListId: string; userVocabularyItemId: string },
  tx: Transaction = db,
) => {
  const link = await getUserVocabularyListItemLink({ userId, userVocabularyListId, userVocabularyItemId }, tx);
  if (!link) {
    throw Exception.notFound(
      `vocabulary list "${userVocabularyListId}" and item "${userVocabularyItemId}" are not linked for user`,
    );
  }

  return link;
};

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

// TODO: mutates the shared/global vocabulary_item row, so any user can edit any other user's view of a word's
// translation (intentional for now, see https://github.com/allohamora/learn-helper/pull/88#discussion_r3576727472).
// If this becomes an issue (vandalism, spam), restrict edits to an admin role.
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
