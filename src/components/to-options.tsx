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

    if (data.options[idx]?.isCorrect) {
      setIsFinished(true);
    } else {
      onMistake(data.id);
    }
  };

  return (
    <div className="mx-auto max-w-2xl">
      <div className="mb-6 text-center">
        <h2 className="mb-2 text-xl font-semibold">{title}</h2>
        <p className="text-muted-foreground">{subtitle}</p>
      </div>

      <Card className="mb-6 bg-card shadow-lg">
        <CardHeader>{children}</CardHeader>

        <CardContent>
          <div className="space-y-3">
            {data.options.map(({ isCorrect, value }, idx) => {
              const isAnswered = answers.has(idx);

              return (
                <Button
                  key={`option-${idx}`}
                  variant="outline"
                  className={cn(
                    'w-full justify-start text-left p-4 h-auto transition-colors duration-200 whitespace-normal [&:disabled]:opacity-80',
                    {
                      'border-green-500 text-green-500': isAnswered && isCorrect,
                      'border-red-500 text-red-500': isAnswered && !isCorrect,
                    },
                  )}
                  onClick={() => onSelectOption(idx)}
                  disabled={isAnswered || isFinished}
                >
                  <div className="flex w-full items-start justify-between gap-3">
                    <span className="flex-1 text-base leading-relaxed">{value}</span>
                  </div>
                </Button>
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
