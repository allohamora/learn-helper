import type { UserWord } from '@/types/user-words.types';
import { type FC } from 'react';
import { Button } from './ui/button';
import { Loader } from './ui/loader';

export type LearningResultProps = {
  userWords: UserWord[];
  mistakes: Record<number, number>;
  isPending: boolean;
};

export const LearningResult: FC<LearningResultProps> = ({ userWords, mistakes, isPending }) => {
  return (
    <div className="space-y-6">
      <div className="mx-auto max-w-2xl text-center">
        <h1 className="mb-4 text-3xl font-bold">Learning Session Complete! 🎉</h1>

        {isPending && (
          <div className="mb-4 flex items-center justify-center">
            <Loader />
          </div>
        )}

        <p className="mb-6 text-lg text-muted-foreground">
          You&apos;ve completed learning {userWords.length} word{userWords.length > 1 ? 's' : ''}.
        </p>

        <div className="mb-6 rounded-lg bg-muted/50 p-6">
          <h3 className="mb-4 font-semibold">Session Summary</h3>
          <div className="space-y-2">
            {userWords.map(({ id, word }) => {
              const mistakeCount = mistakes[id] || 0;
              return (
                <div key={id} className="flex items-center justify-between">
                  <span className="font-medium">{word.value}</span>
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
                </div>
              );
            })}
          </div>
        </div>

        <div className="flex justify-between">
          <div>
            <Button disabled={isPending} asChild>
              <a href="/learning">{isPending ? 'Saving...' : 'Learn More Words'}</a>
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
