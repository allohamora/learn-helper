import { type FC, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ArrowRight } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { FillTheGapTask } from '@/types/user-words.types';

type FillTheGapProps = {
  data: FillTheGapTask['data'];
  onMistake: (userWordId: number) => void;
  onNext: () => void;
};

export const FillTheGap: FC<FillTheGapProps> = ({ data, onMistake, onNext }) => {
  const [answers, setAnswers] = useState<Set<number>>(new Set());
  const [isFinished, setIsFinished] = useState(false);

  const handleSelect = (idx: number) => {
    if (isFinished || answers.has(idx)) {
      return;
    }

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
        <h2 className="mb-2 text-xl font-semibold">Fill in the gap</h2>
        <p className="text-muted-foreground">Choose the word that completes the sentence</p>
      </div>

      <Card className="mb-6 bg-card shadow-lg">
        <CardHeader>
          <CardTitle className="min-h-[80px] text-center text-lg leading-relaxed font-normal">
            {data.sentence}
          </CardTitle>
        </CardHeader>

        <CardContent className="space-y-6">
          <div className="grid gap-3">
            {data.options.map((option, idx) => {
              const isAnswered = answers.has(idx);
              const isCorrect = option.isCorrect;
              const isIncorrectSelection = isAnswered && !isCorrect;

              return (
                <Button
                  key={`option-${idx}`}
                  variant="outline"
                  className={cn(
                    'justify-start px-4 py-3 h-auto text-left text-base transition-colors duration-200 [&:disabled]:opacity-90',
                    {
                      'border-green-500 text-green-600': isAnswered && isCorrect,
                      'border-red-500 text-red-500': isIncorrectSelection,
                    },
                  )}
                  disabled={isFinished || isAnswered}
                  onClick={() => handleSelect(idx)}
                >
                  {option.value}
                </Button>
              );
            })}
          </div>

          {!isFinished && answers.size > 0 && (
            <div className="text-center">
              <p className="font-semibold text-red-600">Almost there. Try another option.</p>
            </div>
          )}

          {isFinished && (
            <div className="text-center">
              <p className="font-semibold text-green-600">Great job! That’s the correct answer.</p>
            </div>
          )}

          {isFinished && (
            <div className="flex justify-center">
              <Button size="lg" onClick={onNext} className="min-w-32">
                Continue
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};
