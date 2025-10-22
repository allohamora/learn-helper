import { type FC } from 'react';
import type { DefinitionToWordTask } from '@/types/user-words.types';
import { TextToWord } from './text-to-word';

type DefinitionToWordProps = {
  data: DefinitionToWordTask['data'];
  onMistake: (userWordId: number) => void;
  onNext: () => void;
};

export const DefinitionToWord: FC<DefinitionToWordProps> = ({ data, ...props }) => {
  return (
    <TextToWord
      title="Which word matches this definition?"
      subtitle="Select the correct word for the given definition"
      id={data.id}
      text={data.definition}
      word={data.word}
      {...props}
    />
  );
};
