import { type FC, useState, useMemo, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ArrowRight } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { Word } from '@/types/user-words.types';

type DefinitionToWordProps = {
  word: Word;
  otherWords: Word[];
  onComplete: (failures: number) => void;
};

type OptionState = 'idle' | 'correct' | 'incorrect';

export const DefinitionToWord: FC<DefinitionToWordProps> = ({ word, otherWords, onComplete }) => {
  const [selectedOption, setSelectedOption] = useState<string | null>(null);
  const [optionStates, setOptionStates] = useState<Record<string, OptionState>>({});
  const [failures, setFailures] = useState(0);
  const [isAnswered, setIsAnswered] = useState(false);

  // Reset state when word changes
  useEffect(() => {
    setSelectedOption(null);
    setOptionStates({});
    setFailures(0);
    setIsAnswered(false);
  }, [word.id]);

  const options = useMemo(() => {
    // Create options array with correct answer and distractors
    const distractors = otherWords.slice(0, Math.min(3, otherWords.length));
    const allOptions = [word, ...distractors];

    // Shuffle options using Fisher-Yates algorithm for better randomness
    const shuffled = [...allOptions];
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }

    return shuffled.map((w) => ({ id: w.id, value: w.value, partOfSpeech: w.partOfSpeech }));
  }, [word.id, otherWords.map((w) => w.id).join(',')]);

  const handleOptionSelect = (optionId: number) => {
    if (isAnswered) return;

    const isCorrect = optionId === word.id;
    setSelectedOption(optionId.toString());

    if (isCorrect) {
      setOptionStates((prev) => ({ ...prev, [optionId]: 'correct' }));
      setIsAnswered(true);
    } else {
      setOptionStates((prev) => ({ ...prev, [optionId]: 'incorrect' }));
      setFailures((prev) => prev + 1);
      // Allow retry after a brief delay
      setTimeout(() => {
        setSelectedOption(null);
      }, 1000);
    }
  };

  const handleContinue = () => {
    onComplete(failures);
  };

  return (
    <div className="mx-auto max-w-2xl">
      <div className="mb-6 text-center">
        <h2 className="mb-2 text-xl font-semibold">Which word matches this definition?</h2>
        <p className="text-muted-foreground">Select the correct word for the given definition</p>
      </div>

      <Card className="bg-card mb-6 shadow-lg">
        <CardHeader>
          <CardTitle className="flex min-h-[120px] items-center justify-center text-center">
            <p className="text-xl leading-relaxed font-normal">{word.definition}</p>
          </CardTitle>
        </CardHeader>

        <CardContent className="space-y-3">
          <div className="space-y-3">
            {options.map((option) => {
              const state = optionStates[option.id] || 'idle';
              const isSelected = selectedOption === option.id.toString();

              return (
                <Button
                  key={option.id}
                  variant="outline"
                  className={cn('w-full justify-start text-left p-4 h-auto transition-colors duration-200', {
                    'border-green-500 bg-green-50 text-green-700': state === 'correct',
                    'border-red-500 bg-red-50 text-red-700': state === 'incorrect',
                    'border-primary bg-primary/5': isSelected && state === 'idle',
                  })}
                  onClick={() => handleOptionSelect(option.id)}
                  disabled={isAnswered}
                >
                  <div className="flex w-full items-center justify-between">
                    <div>
                      <span className="text-base font-semibold">{option.value}</span>
                      {option.partOfSpeech && (
                        <span className="text-muted-foreground ml-2 text-sm">
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

      {failures > 0 && (
        <div className="mb-4 text-center">
          <p className="text-muted-foreground text-sm">
            {failures} incorrect attempt{failures > 1 ? 's' : ''}
          </p>
        </div>
      )}

      {isAnswered && (
        <div className="text-center">
          <Button onClick={handleContinue} size="lg" className="px-8">
            Continue
            <ArrowRight className="ml-2 h-4 w-4" />
          </Button>
        </div>
      )}
    </div>
  );
};
