import { type FC } from 'react';
import type { TextToWordData } from '@/types/user-words.types';
import { ToWord } from './to-word';
import { HintButton } from './hint-button';

type TextToWordProps = {
  title: string;
  subtitle: string;
  data: TextToWordData;
  onMistake: (userWordId: number) => void;
  onNext: () => void;
};

export const TextToWord: FC<TextToWordProps> = ({ data: { text, hint, ...data }, ...props }) => {
  return (
    <ToWord data={data} {...props}>
      <p className="w-full text-center text-lg leading-relaxed font-normal md:text-xl">
        <span className="align-middle">{text}</span>
        {hint && <HintButton hint={hint} className="ml-2 align-middle" />}
      </p>
    </ToWord>
  );
};
