import type { UserWord } from '@/types/user-words.types';
import { type FC } from 'react';
import { Button } from './ui/button';
import { NextStep } from './next-step';

export type LearningResultProps = {
  userWords: UserWord[];
  mistakes: Record<number, number>;
};

export const LearningResult: FC<LearningResultProps> = ({ userWords, mistakes }) => {
  return (
    <div className="space-y-4 md:space-y-6">
      <div className="mx-auto max-w-2xl text-center">
        <h1 className="mb-2 text-2xl font-bold md:mb-4 md:text-3xl">Learning Session Complete! 🎉</h1>

        <p className="mb-4 text-base text-muted-foreground md:mb-6 md:text-lg">
          You&apos;ve completed learning {userWords.length} word{userWords.length > 1 ? 's' : ''}.
        </p>

        <div className="mb-4 rounded-lg bg-muted/50 p-4 md:mb-6 md:p-6">
          <h3 className="mb-2 text-sm font-semibold md:mb-4 md:text-base">Session Summary</h3>
          <div className="space-y-2">
            {userWords.map(({ id, word }) => {
              const mistakeCount = mistakes[id] || 0;
              return (
                <div key={id} className="flex items-center justify-between gap-4">
                  <div className="text-sm font-medium md:text-base">
                    <span>{word.value}</span>
                    {word.partOfSpeech && (
                      <span className="ml-2 text-xs text-muted-foreground md:text-sm">
                        ({word.partOfSpeech.toLowerCase()})
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-3">
                    <span
                      className={
                        mistakeCount === 0
                          ? 'text-sm font-semibold text-green-600 md:text-base'
                          : mistakeCount === 1
                            ? 'text-sm font-semibold text-yellow-600 md:text-base'
                            : 'text-sm font-semibold text-red-600 md:text-base'
                      }
                    >
                      {mistakeCount} mistake{mistakeCount !== 1 ? 's' : ''}
                    </span>
                    <NextStep userWordId={id} />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <div className="flex flex-col gap-4 sm:flex-row sm:justify-between">
          <div className="w-full sm:w-auto">
            <Button asChild className="w-full sm:w-auto">
              <a href="/learning">Learn More Words</a>
            </Button>
          </div>

          <div className="flex flex-col gap-2 sm:flex-row sm:space-x-2">
            <Button variant="outline" asChild className="w-full sm:w-auto">
              <a href="/words">View All Words</a>
            </Button>

            <Button variant="outline" asChild className="w-full sm:w-auto">
              <a href="/">Back to Dashboard</a>
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};
