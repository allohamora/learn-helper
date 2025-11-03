import { type FC } from 'react';
import type { SynonymAntonymData } from '@/types/user-words.types';
import { ToWord } from './to-word';

type SynonymAntonymToWordProps = {
  title: string;
  subtitle: string;
  data: SynonymAntonymData;
  onMistake: (userWordId: number) => void;
  onNext: () => void;
};

export const SynonymAntonymToWord: FC<SynonymAntonymToWordProps> = ({
  data: { synonym, antonym, ...data },
  ...props
}) => {
  return (
    <ToWord data={data} {...props}>
      <div className="flex w-full flex-wrap items-center justify-around text-center text-lg leading-relaxed font-semibold md:text-xl">
        <span className="text-blue-400">{synonym}</span>
        <span>|</span>
        <span className="text-orange-400">{antonym}</span>
      </div>
    </ToWord>
  );
};
