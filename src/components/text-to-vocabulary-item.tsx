import { type FC } from 'react';
import type { UserVocabularyItemTaskType } from '@/const/event';
import type { TextToVocabularyItemData } from '@/types/learning';
import { ToVocabularyItem } from './to-vocabulary-item';

type TextToVocabularyItemProps = {
  title: string;
  subtitle: string;
  userVocabularyListId: string;
  taskType: UserVocabularyItemTaskType;
  data: TextToVocabularyItemData;
  onMistake: (userVocabularyItemId: string) => void;
  onNext: () => void;
};

export const TextToVocabularyItem: FC<TextToVocabularyItemProps> = ({ data: { text, ...data }, ...props }) => {
  return (
    <ToVocabularyItem data={data} {...props}>
      <p className="w-full text-center text-lg leading-relaxed font-normal md:text-xl">{text}</p>
    </ToVocabularyItem>
  );
};
