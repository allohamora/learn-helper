import type { ShowcaseTask } from '@/types/user-words.types';
import { type FC } from 'react';
import { Button } from './ui/button';

export type LearningResultProps = {
  showcaseTasks: ShowcaseTask[];
  mistakes: Record<number, number>;
  isPending: boolean;
};

export const LearningResult: FC<LearningResultProps> = ({ showcaseTasks, mistakes, isPending }) => {
  return (
    <div className="space-y-6">
      <div className="mx-auto max-w-2xl text-center">
        <h1 className="mb-4 text-3xl font-bold">Learning Session Complete! 🎉</h1>

        {isPending && (
          <div className="mb-4 flex items-center justify-center">
            <div className="border-primary mx-auto mb-4 h-8 w-8 animate-spin rounded-full border-b-2"></div>
            <span className="text-muted-foreground">Updating word progress...</span>
          </div>
        )}

        <p className="text-muted-foreground mb-6 text-lg">
          You&apos;ve completed learning {showcaseTasks.length} word{showcaseTasks.length > 1 ? 's' : ''}.
        </p>

        <div className="bg-muted/50 mb-6 rounded-lg p-6">
          <h3 className="mb-4 font-semibold">Session Summary</h3>
          <div className="space-y-2">
            {showcaseTasks.map((task) => {
              const mistakeCount = mistakes[task.data.id] || 0;
              return (
                <div key={task.data.id} className="flex items-center justify-between">
                  <span className="font-medium">{task.data.value}</span>
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
            <Button disabled={isPending}>
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
