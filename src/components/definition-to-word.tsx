import { useState, type FC } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ArrowRight } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { DefinitionToWordTask } from '@/types/user-words.types';

type DefinitionToWordProps = {
  data: DefinitionToWordTask['data'];
  onMistake: (userWordId: number) => void;
  onNext: () => void;
};

export const DefinitionToWord: FC<DefinitionToWordProps> = ({ data, onMistake, onNext }) => {
  const [answers, setAnswers] = useState<Set<number>>(new Set());
  const [isFinished, setIsFinished] = useState(false);

  const onSelectOption = (optionId: number) => {
    setAnswers((prev) => new Set(prev).add(optionId));

    if (data.options.find((opt) => opt.id === optionId)?.isCorrect) {
      setIsFinished(true);
    } else {
      onMistake(data.id);
    }
  };

  return (
    <div className="mx-auto max-w-2xl">
      <div className="mb-6 text-center">
        <h2 className="mb-2 text-xl font-semibold">Which word matches this definition?</h2>
        <p className="text-muted-foreground">Select the correct word for the given definition</p>
      </div>

      <Card className="mb-6 bg-card shadow-lg">
        <CardHeader>
          <CardTitle className="flex min-h-[120px] items-center justify-center text-center">
            <p className="text-xl leading-relaxed font-normal">{data.definition}</p>
          </CardTitle>
        </CardHeader>

        <CardContent className="space-y-3">
          <div className="space-y-3">
            {data.options.map((option) => {
              const isAnswered = answers.has(option.id);

              return (
                <Button
                  key={option.id}
                  variant="outline"
                  className={cn(
                    'w-full justify-start text-left p-4 h-auto transition-colors duration-200 [&:disabled]:opacity-80',
                    {
                      'border-green-500 text-green-500': isAnswered && option.isCorrect,
                      'border-red-500 text-red-500': isAnswered && !option.isCorrect,
                    },
                  )}
                  onClick={() => onSelectOption(option.id)}
                  disabled={isFinished || isAnswered}
                >
                  <div className="flex w-full items-center justify-between">
                    <div>
                      <span className="text-base font-semibold">{option.value}</span>
                      {option.partOfSpeech && (
                        <span className="ml-2 text-sm text-muted-foreground">
                          ({option.partOfSpeech.toLowerCase()})
                        </span>
                      )}
                    </div>
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
