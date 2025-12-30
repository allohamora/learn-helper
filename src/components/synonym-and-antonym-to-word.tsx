import { type FC } from 'react';
import type { SynonymAndAntonymData, TaskType } from '@/types/user-words.types';
import { ToWord } from './to-word';

type SynonymAndAntonymToWordProps = {
  title: string;
  subtitle: string;
  taskType: TaskType;
  data: SynonymAndAntonymData;
  onMistake: (userWordId: number) => void;
  onNext: () => void;
};

export const SynonymAndAntonymToWord: FC<SynonymAndAntonymToWordProps> = ({
  data: { synonym, antonym, ...data },
  ...props
}) => {
  return (
    <ToWord data={data} {...props}>
      <div className="flex flex-wrap items-center justify-around gap-2 text-center text-lg font-semibold md:gap-3 md:text-xl">
        <span className="text-blue-400">{synonym}</span>
        <span>|</span>
        <span className="text-orange-400">{antonym}</span>
      </div>
    </ToWord>
  );
};
