import { type FC } from 'react';
import { Link } from '@tanstack/react-router';
import type { LearningItem } from '@/types/learning';
import { Button } from './ui/button';
import { NextLearningStep } from './next-learning-step';

export type LearningResultProps = {
  userVocabularyListId: string;
  items: LearningItem[];
  mistakes: Record<string, number>;
};

export const LearningResult: FC<LearningResultProps> = ({ userVocabularyListId, items, mistakes }) => {
  return (
    <div className="space-y-4 md:space-y-6">
      <div className="mx-auto max-w-2xl text-center">
        <h1 className="mb-2 text-2xl font-bold md:mb-4 md:text-3xl">Learning Session Complete! 🎉</h1>

        <p className="mb-4 text-base text-muted-foreground md:mb-6 md:text-lg">
          You&apos;ve completed learning {items.length} word{items.length > 1 ? 's' : ''}.
        </p>

        <div className="mb-4 rounded-lg bg-muted/50 p-4 md:mb-6 md:p-6">
          <h3 className="mb-2 text-sm font-semibold md:mb-4 md:text-base">Session Summary</h3>
          <div className="space-y-2">
            {items.map((item) => {
              const mistakeCount = mistakes[item.id] || 0;
              return (
                <div key={item.id} className="flex items-center justify-between gap-4">
                  <div className="text-sm font-medium md:text-base">
                    <span>{item.vocabularyItem.value}</span>
                    {item.vocabularyItem.partOfSpeech && (
                      <span className="ml-2 text-xs text-muted-foreground md:text-sm">
                        ({item.vocabularyItem.partOfSpeech.toLowerCase()})
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
                    <NextLearningStep userVocabularyListId={userVocabularyListId} userVocabularyItemId={item.id} />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <div className="flex flex-col gap-4 sm:flex-row sm:justify-between">
          <div className="w-full sm:w-auto">
            <Button asChild className="w-full sm:w-auto">
              <Link to="/vocabulary/$userVocabularyListId/learning" params={{ userVocabularyListId }} reloadDocument>
                Learn More Words
              </Link>
            </Button>
          </div>

          <div className="flex flex-col gap-2 sm:flex-row sm:space-x-2">
            <Button variant="outline" asChild className="w-full sm:w-auto">
              <Link to="/vocabulary/$userVocabularyListId" params={{ userVocabularyListId }}>
                View All Words
              </Link>
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};
