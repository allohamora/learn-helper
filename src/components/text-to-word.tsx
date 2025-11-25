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
      <div className="flex w-full flex-col items-center gap-3 text-center">
        <div className="flex w-full items-start justify-center gap-2">
          <p className="text-lg leading-relaxed font-normal md:text-xl">{text}</p>
          {hint ? (
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              className="cursor-pointer"
              title={hint}
              aria-label="Show hint"
              onClick={() => toast({ title: 'hint', description: hint, variant: 'default' })}
            >
              <CircleQuestionMarkIcon className="size-4" />
            </Button>
          ) : null}
        </div>
      </div>
    </ToWord>
  );
};
