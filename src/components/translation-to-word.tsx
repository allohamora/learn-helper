import { type FC } from 'react';
import type { TranslationToWordTask } from '@/types/user-words.types';
import { TextToWord } from './text-to-word';

type TranslationToWordProps = {
  data: TranslationToWordTask['data'];
  onMistake: (userWordId: number) => void;
  onNext: () => void;
};

export const TranslationToWord: FC<TranslationToWordProps> = ({ data, ...props }) => {
  return (
    <TextToWord
      title="Which word matches this translation?"
      subtitle="Type the correct word for the given translation"
      id={data.id}
      text={data.translation}
      word={data.word}
      {...props}
    />
  );
};
