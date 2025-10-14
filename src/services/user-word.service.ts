import {
  decreaseMaxWordsToUnlock,
  getMaxWordsToUnlock,
  getUserWordById,
  updateUserWord,
} from '@/repositories/user-word.repository';
import type { AuthParams } from '@/types/auth.types';
import { Status } from '@/types/user-words.types';

const REVIEW_AFTER_VALUE = 3;

export const moveUserWordToNextStep = async (data: AuthParams<{ userWordId: number }>) => {
  const userWord = await getUserWordById(data);
  const appearsLeft = userWord.appearsLeft - 1;

  await decreaseMaxWordsToUnlock(data);

  if (appearsLeft <= 0) {
    await updateUserWord({ ...data, wordsToUnlock: 0, appearsLeft: 0, status: Status.Learned });
  } else {
    const maxWordsToUnlock = await getMaxWordsToUnlock(data);

    await updateUserWord({ ...data, wordsToUnlock: maxWordsToUnlock + REVIEW_AFTER_VALUE, appearsLeft });
  }
};
