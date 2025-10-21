import { useState, type FC } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ArrowRight } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { TranslateSentenceTask } from '@/types/user-words.types';

type TranslateSentenceProps = {
  data: TranslateSentenceTask['data'];
  onMistake: (userWordId: number) => void;
  onNext: () => void;
};

export const TranslateSentence: FC<TranslateSentenceProps> = ({ data, onMistake, onNext }) => {
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
        <h2 className="mb-2 text-xl font-semibold">Select the correct translation</h2>
        <p className="text-muted-foreground">Choose the English sentence that best matches the Ukrainian sentence</p>
      </div>

      <Card className="mb-6 bg-card shadow-lg">
        <CardHeader>
          <CardTitle className="flex min-h-[120px] items-center justify-center text-lg">{data.sentence}</CardTitle>
        </CardHeader>

        <CardContent className="space-y-6">
          <div className="space-y-4">
            <div className="space-y-3">
              {data.options.map((option, idx) => {
                const isAnswered = answers.has(idx);

                return (
                  <Button
                    key={`option-${idx}`}
                    variant="outline"
                    className={cn(
                      'w-full justify-start text-left p-4 h-auto transition-colors duration-200 [&:disabled]:opacity-80',
                      {
                        'border-green-500 text-green-500': isAnswered && option.isCorrect,
                        'border-red-500 text-red-500': isAnswered && !option.isCorrect,
                      },
                    )}
                    onClick={() => onSelectOption(idx)}
                    disabled={isFinished || isAnswered}
                  >
                    <div className="flex w-full items-center justify-between">
                      <div>
                        <span className="text-base font-semibold">{option.value}</span>
                      </div>
                    </div>
                  </Button>
                );
              })}
            </div>
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
