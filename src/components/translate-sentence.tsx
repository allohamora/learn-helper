import { type FC } from 'react';
import { CardTitle } from '@/components/ui/card';
import type { TranslateSentenceData } from '@/types/user-words.types';
import { ToOptions } from './to-options';

type TranslateSentenceProps = {
  title: string;
  subtitle: string;
  data: TranslateSentenceData;
  onMistake: (userWordId: number) => void;
  onNext: () => void;
};

export const TranslateSentence: FC<TranslateSentenceProps> = ({ data: { sentence, ...data }, ...props }) => {
  return (
    <ToOptions data={data} {...props}>
      <CardTitle className="flex min-h-[120px] items-center justify-center text-lg">{sentence}</CardTitle>
    </ToOptions>
  );
};
