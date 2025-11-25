import { type FC } from 'react';
import type { TextToWordData } from '@/types/user-words.types';
import { ToWord } from './to-word';
import { Button } from '@/components/ui/button';
import { CircleQuestionMarkIcon } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

type TextToWordProps = {
  title: string;
  subtitle: string;
  data: TextToWordData;
  onMistake: (userWordId: number) => void;
  onNext: () => void;
};

export const TextToWord: FC<TextToWordProps> = ({ data: { text, hint, ...data }, ...props }) => {
  const { toast } = useToast();

  return (
    <ToWord data={data} {...props}>
      <p className="w-full text-center text-lg leading-relaxed font-normal md:text-xl">
        <span className="align-middle">{text}</span>
        {hint && (
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            className="ml-2 size-6 cursor-pointer align-middle"
            title={hint}
            aria-label="Show hint"
            onClick={() => toast({ title: 'Hint', description: hint, variant: 'default' })}
          >
            <CircleQuestionMarkIcon className="size-4" />
          </Button>
        )}
      </p>
    </ToWord>
  );
};
