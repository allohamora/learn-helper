import { useState, type FC, type KeyboardEvent, type PropsWithChildren } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ArrowRight } from 'lucide-react';
import { cn } from '@/lib/utils';
import { SttButton } from './stt-button';
import type { ToWordData } from '@/types/user-words.types';

type ToWordProps = {
  title: string;
  subtitle: string;
  data: ToWordData;
  onMistake: (userWordId: number) => void;
  onNext: () => void;
};

const unique = (values: string[]) => Array.from(new Set(values));

const toRegexp = (text: string) => {
  const pattern = text.replace(/ \(/g, ' *(').replace(/\(.*?\)/, (match) => {
    const fullValue = match.replace('(', '').replace(')', '');

    const values = unique([fullValue, ...fullValue.split('/')])
      .map((value) => `(?:${value})`)
      .join('|');

    return `(?:\\((?:${values})\\))?`;
  });

  return new RegExp(`^${pattern}$`, 'i');
};

const normalize = (text: string) => text.toLowerCase().trim();

export const compare = ({ answer, input }: { answer: string; input: string }) => {
  const pattern = toRegexp(normalize(answer));

  return pattern.test(normalize(input));
};

export const ToWord: FC<PropsWithChildren<ToWordProps>> = ({ title, subtitle, data, onMistake, onNext, children }) => {
  const [userInput, setUserInput] = useState('');
  const [isChecked, setIsChecked] = useState(false);
  const [isCorrect, setIsCorrect] = useState<boolean | null>(null);

  const handleCheck = () => {
    const correct = compare({ answer: data.word, input: userInput });

    setIsCorrect(correct);
    setIsChecked(true);

    if (!correct) {
      onMistake(data.id);
    }
  };

  const handleNext = () => {
    onNext();
  };

  const handleKeyPress = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key !== 'Enter') {
      return;
    }

    if (isChecked) {
      handleNext();
      return;
    }

    if (userInput.trim()) {
      handleCheck();
      return;
    }
  };

  return (
    <div className="mx-auto max-w-2xl">
      <div className="mb-6 text-center">
        <h2 className="mb-2 text-xl font-semibold">{title}</h2>
        <p className="text-muted-foreground">{subtitle}</p>
      </div>

      <Card className="mb-6 bg-card shadow-lg">
        <CardHeader>
          <CardTitle className="flex min-h-[120px] items-center justify-center text-center">{children}</CardTitle>
        </CardHeader>

        <CardContent className="space-y-6">
          <div className="space-y-4">
            <div className="relative">
              <Input
                type="text"
                value={userInput}
                onChange={(e) => setUserInput(e.target.value)}
                onKeyDown={handleKeyPress}
                placeholder="Type the correct word..."
                className={cn(
                  'h-12 text-lg',
                  isChecked &&
                    'focus-visible:border focus-visible:ring-0 pointer-events-none cursor-not-allowed opacity-50',
                  isChecked && isCorrect && 'focus-visible:border-green-500 border-green-500 bg-green-50',
                  isChecked && !isCorrect && 'focus-visible:border-red-500 border-red-500 bg-red-50',
                )}
                readOnly={isChecked}
              />
              <div className="absolute top-1/2 right-2 -translate-y-1/2">
                <SttButton onText={setUserInput} disabled={isChecked} className={cn('h-8 w-8')} />
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
                      The correct answer is: <span className="font-semibold text-foreground">{data.word}</span>
                    </p>
                  </div>
                )}
              </div>
            )}

            <div className="flex justify-center">
              {!isChecked ? (
                <Button onClick={handleCheck} size="lg" disabled={!userInput.trim()} className="min-w-32">
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
