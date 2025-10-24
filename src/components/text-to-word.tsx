import { type FC } from 'react';
import type { TextToWordData } from '@/types/user-words.types';
import { ToWord } from './to-word';

type TextToWordProps = {
  title: string;
  subtitle: string;
  data: TextToWordData;
  onMistake: (userWordId: number) => void;
  onNext: () => void;
};

export const TextToWord: FC<TextToWordProps> = ({ data: { text, ...data }, ...props }) => {
  return (
    <ToWord data={data} {...props}>
      <p className="text-xl leading-relaxed font-normal">{text}</p>
    </ToWord>
  );
};
