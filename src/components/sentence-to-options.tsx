import { type FC } from 'react';
import { CardTitle } from '@/components/ui/card';
import type { SentenceData, TaskType } from '@/types/user-words.types';
import { ToOptions } from './to-options';

type SentenceToOptionsProps = {
  title: string;
  subtitle: string;
  taskType: TaskType;
  data: SentenceData;
  onMistake: (userWordId: number) => void;
  onNext: () => void;
};

export const SentenceToOptions: FC<SentenceToOptionsProps> = ({ data: { sentence, ...data }, ...props }) => {
  return (
    <ToOptions data={data} {...props}>
      <CardTitle className="flex min-h-[120px] items-center justify-center text-center text-lg">{sentence}</CardTitle>
    </ToOptions>
  );
};
