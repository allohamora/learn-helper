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
    <div className="space-y-6">
      <div className="mx-auto max-w-2xl text-center">
        <h1 className="mb-4 text-3xl font-bold">Learning Session Complete! 🎉</h1>

        <p className="mb-6 text-lg text-muted-foreground">
          You&apos;ve completed learning {userWords.length} word{userWords.length > 1 ? 's' : ''}.
        </p>

        <div className="mb-6 rounded-lg bg-muted/50 p-6">
          <h3 className="mb-4 font-semibold">Session Summary</h3>
          <div className="space-y-2">
            {userWords.map(({ id, word }) => {
              const mistakeCount = mistakes[id] || 0;
              return (
                <div key={id} className="flex items-center justify-between gap-4">
                  <div className="font-medium">
                    <span>{word.value}</span>
                    {word.partOfSpeech && (
                      <span className="ml-2 text-sm text-muted-foreground">({word.partOfSpeech.toLowerCase()})</span>
                    )}
                  </div>
                  <div className="flex items-center gap-3">
                    <span
                      className={
                        mistakeCount === 0
                          ? 'font-semibold text-green-600'
                          : mistakeCount === 1
                            ? 'font-semibold text-yellow-600'
                            : 'font-semibold text-red-600'
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

        <div className="flex justify-between">
          <div>
            <Button asChild>
              <a href="/learning">Learn More Words</a>
            </Button>
          </div>

          <div className="space-x-2">
            <Button variant="outline" asChild>
              <a href="/words">View All Words</a>
            </Button>

            <Button variant="outline" asChild>
              <a href="/">Back to Dashboard</a>
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};
