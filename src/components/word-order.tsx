import { useState, type FC } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ArrowRight } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { WordOrderTask } from '@/types/user-words.types';

type Data = WordOrderTask['data'];

type WordOrderProps = {
  title: string;
  subtitle: string;
  data: Data;
  onMistake: (userWordId: number) => void;
  onNext: () => void;
};

export const WordOrder: FC<WordOrderProps> = ({ title, subtitle, data, onMistake, onNext }) => {
  const [selectedWords, setSelectedWords] = useState<string[]>([]);
  const [availableWords, setAvailableWords] = useState<string[]>(data.shuffledWords);
  const [isChecked, setIsChecked] = useState(false);
  const [isCorrect, setIsCorrect] = useState<boolean | null>(null);

  const handleWordClick = (word: string, index: number) => {
    if (isChecked) return;

    setSelectedWords([...selectedWords, word]);
    setAvailableWords(availableWords.filter((_, idx) => idx !== index));
  };

  const handleRemoveWord = (word: string, index: number) => {
    if (isChecked) return;

    setSelectedWords(selectedWords.filter((_, idx) => idx !== index));
    setAvailableWords([...availableWords, word]);
  };

  const handleCheck = () => {
    const correct = selectedWords.join(' ') === data.originalWords.join(' ');

    setIsCorrect(correct);
    setIsChecked(true);

    if (!correct) {
      onMistake(data.id);
    }
  };

  const handleNext = () => {
    onNext();
  };

  return (
    <div className="mx-auto max-w-2xl">
      <div className="mb-4 text-center md:mb-6">
        <h2 className="mb-2 text-lg font-semibold md:text-xl">{title}</h2>
        <p className="text-sm text-muted-foreground">{subtitle}</p>
      </div>

      <Card className="mb-4 gap-4 bg-card py-4 shadow-lg md:mb-6 md:gap-6 md:py-6">
        <CardHeader className="px-4 md:px-6">
          <CardTitle className="flex min-h-[100px] items-center justify-center text-center md:min-h-[120px]">
            <div className="flex flex-wrap items-center justify-center gap-2">
              {selectedWords.length === 0 ? (
                <span className="text-muted-foreground">Select words below to build the sentence</span>
              ) : (
                selectedWords.map((word, index) => {
                  const isCorrectPosition = isChecked && data.originalWords[index] === word;

                  return (
                    <button
                      key={`${word}-${index}`}
                      type="button"
                      onClick={() => handleRemoveWord(word, index)}
                      disabled={isChecked}
                      className={cn(
                        'inline-flex items-center rounded-md bg-primary/10 px-3 py-1.5 text-base font-medium transition-colors md:text-lg',
                        !isChecked && 'cursor-pointer hover:bg-primary/20 active:bg-primary/30',
                        isChecked && 'cursor-default',
                        isCorrectPosition && 'bg-green-100 text-green-800',
                        isChecked && !isCorrectPosition && 'bg-red-100 text-red-800',
                      )}
                      aria-label={isChecked ? undefined : `Remove ${word}`}
                    >
                      {word}
                    </button>
                  );
                })
              )}
            </div>
          </CardTitle>
        </CardHeader>

        <CardContent className="space-y-6 px-4 md:px-6">
          <div className="space-y-4">
            <div>
              <div className="flex flex-wrap justify-center gap-2">
                {availableWords.map((word, index) => (
                  <Button
                    key={`${word}-${index}`}
                    type="button"
                    variant="outline"
                    onClick={() => handleWordClick(word, index)}
                    disabled={isChecked}
                    className="h-auto px-4 py-2 text-base md:text-lg"
                  >
                    {word}
                  </Button>
                ))}
              </div>
            </div>

            {isChecked && (
              <div className="text-center">
                {isCorrect ? (
                  <p className="font-semibold text-green-600">Correct</p>
                ) : (
                  <div className="space-y-2">
                    <p className="font-semibold text-red-600">Incorrect</p>
                    <p className="text-muted-foreground">
                      The correct order is:{' '}
                      <span className="font-semibold text-foreground">{data.originalWords.join(' ')}</span>
                    </p>
                  </div>
                )}
              </div>
            )}

            <div className="flex justify-center">
              {!isChecked ? (
                <Button
                  onClick={handleCheck}
                  size="lg"
                  disabled={selectedWords.length !== data.originalWords.length}
                  className="min-w-32"
                >
                  Check
                </Button>
              ) : (
                <Button onClick={handleNext} size="lg" className="min-w-32">
                  Continue
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              )}
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};
