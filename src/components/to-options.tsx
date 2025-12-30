import { type FC, type PropsWithChildren, useState } from 'react';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ArrowRight } from 'lucide-react';
import { cn } from '@/lib/utils';
import { type ToOptionsData } from '@/types/user-words.types';

type ToOptionsProps = {
  title: string;
  subtitle: string;
  data: ToOptionsData;
  onMistake: (userWordId: number) => void;
  onNext: () => void;
};

export const ToOptions: FC<PropsWithChildren<ToOptionsProps>> = ({
  data,
  title,
  subtitle,
  onMistake,
  onNext,
  children,
}) => {
  const [answers, setAnswers] = useState<Set<number>>(new Set());
  const [isFinished, setIsFinished] = useState(false);

  const onSelectOption = (idx: number) => {
    setAnswers((prev) => new Set(prev).add(idx));

    if (data.options[idx]?.isAnswer) {
      setIsFinished(true);
    } else {
      onMistake(data.id);
    }
  };

  return (
    <div className="mx-auto max-w-2xl">
      <div className="mb-4 text-center md:mb-6">
        <h2 className="mb-2 text-lg font-semibold md:text-xl">{title}</h2>
        <p className="text-sm text-muted-foreground">{subtitle}</p>
      </div>

      <Card className="mb-4 gap-4 bg-card py-4 shadow-lg md:mb-6 md:gap-6 md:py-6">
        <CardHeader className="px-4 md:px-6">{children}</CardHeader>

        <CardContent className="px-4 md:px-6">
          <div className="space-y-3">
            {data.options.map(({ isAnswer, value, description }, idx) => {
              const isAnswered = answers.has(idx);

              return (
                <div key={`option-${idx}`} className="space-y-2">
                  <Button
                    variant="outline"
                    className={cn(
                      'w-full justify-start text-left p-4 h-auto transition-colors duration-200 whitespace-normal [&:disabled]:opacity-80',
                      {
                        'border-green-500 text-green-500': isAnswered && isAnswer,
                        'border-red-500 text-red-500': isAnswered && !isAnswer,
                      },
                    )}
                    onClick={() => onSelectOption(idx)}
                    disabled={isAnswered || isFinished}
                  >
                    <div className="flex w-full items-start justify-between gap-3">
                      <span className="flex-1 text-sm leading-relaxed md:text-base">{value}</span>
                    </div>
                  </Button>
                  {isAnswered && description && (
                    <div className="ml-4 rounded-md bg-muted p-3 text-sm text-muted-foreground">{description}</div>
                  )}
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {isFinished && (
        <div className="text-center">
          <Button onClick={onNext} size="lg" className="px-8">
            Next
            <ArrowRight className="ml-2 h-4 w-4" />
          </Button>
        </div>
      )}
    </div>
  );
};
