import { type FC } from 'react';
import { useQuery } from '@tanstack/react-query';
import { actions } from 'astro:actions';
import { Button } from '@/components/ui/button';
import { LearningResult } from './learning-result';
import { Loader } from './ui/loader';

export const Learning: FC = () => {
  const getLearningWords = useQuery({
    queryKey: ['getLearningWords'],
    queryFn: async () => {
      return await actions.getLearningWords.orThrow({});
    },
  });

  if (getLearningWords.isLoading) {
    return (
      <div className="flex items-center justify-center">
        <Loader />
      </div>
    );
  }

  if (getLearningWords.error) {
    return (
      <div className="space-y-6">
        <div className="mx-auto max-w-2xl text-center">
          <h1 className="mb-4 text-2xl font-bold">Something went wrong</h1>
          <p className="mb-6 text-muted-foreground">Failed to load learning data. Please try again.</p>
          <Button size="lg" asChild>
            <a href="/learning">Try Again</a>
          </Button>
        </div>
      </div>
    );
  }

  const learningWords = getLearningWords.data ?? [];

  if (learningWords.length === 0) {
    return (
      <div className="space-y-6">
        <div className="mx-auto max-w-2xl text-center">
          <h1 className="mb-4 text-2xl font-bold">No Words to Learn</h1>
          <p className="mb-6 text-lg text-muted-foreground">You have no words to learn at the moment.</p>
          <Button size="lg" asChild>
            <a href="/words">View All Words</a>
          </Button>
        </div>
      </div>
    );
  }

  return <LearningResult userWords={learningWords} mistakes={{}} />;
};
