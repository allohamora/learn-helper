import {
  decreaseMaxWordsToUnlock,
  getMaxWordsToUnlock,
  getUserWordById,
  updateUserWord,
} from '@/repositories/user-word.repository';
import type { AuthParams } from '@/types/auth.types';
import { Status } from '@/types/user-words.types';

const REVIEW_AFTER_VALUE = 3;
const MAX_ENCOUNTER_COUNT = 3;

export const moveUserWordToNextStep = async (data: AuthParams<{ userWordId: number }>) => {
  const userWord = await getUserWordById(data);
  const encounterCount = userWord.encounterCount + 1;

  await decreaseMaxWordsToUnlock(data);

  if (encounterCount >= MAX_ENCOUNTER_COUNT) {
    await updateUserWord({ ...data, wordsToUnlock: 0, encounterCount, status: Status.Learned });
  } else {
    const maxWordsToUnlock = await getMaxWordsToUnlock(data);

    await updateUserWord({ ...data, wordsToUnlock: maxWordsToUnlock + REVIEW_AFTER_VALUE, encounterCount });
  }
};
