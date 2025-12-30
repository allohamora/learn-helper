import { type FC } from 'react';
import type { TextToWordData, TaskType } from '@/types/user-words.types';
import { ToWord } from './to-word';

type TextToWordProps = {
  title: string;
  subtitle: string;
  taskType: TaskType;
  data: TextToWordData;
  onMistake: (userWordId: number) => void;
  onNext: () => void;
};

export const TextToWord: FC<TextToWordProps> = ({ data: { text, ...data }, ...props }) => {
  return (
    <ToWord data={data} {...props}>
      <p className="w-full text-center text-lg leading-relaxed font-normal md:text-xl">{text}</p>
    </ToWord>
  );
};
