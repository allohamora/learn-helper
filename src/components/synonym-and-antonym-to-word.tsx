import { type FC } from 'react';
import type { SynonymAndAntonymData } from '@/types/user-words.types';
import { ToWord } from './to-word';
import { HintButton } from './hint-button';

type SynonymAndAntonymToWordProps = {
  title: string;
  subtitle: string;
  data: SynonymAndAntonymData;
  onMistake: (userWordId: number) => void;
  onNext: () => void;
};

export const SynonymAndAntonymToWord: FC<SynonymAndAntonymToWordProps> = ({
  data: { synonym, antonym, hint, ...data },
  ...props
}) => {
  return (
    <ToWord data={data} {...props}>
      <div className="flex w-full items-center justify-center gap-3">
        <div className="flex flex-wrap items-center justify-around gap-2 text-center text-lg font-semibold md:gap-3 md:text-xl">
          <span className="text-blue-400">{synonym}</span>
          <span>|</span>
          <span className="text-orange-400">{antonym}</span>
        </div>
        {hint && <HintButton hint={hint} className="shrink-0" />}
      </div>
    </ToWord>
  );
};
