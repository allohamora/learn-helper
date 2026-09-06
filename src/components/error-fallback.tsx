import { useNavigate } from '@tanstack/react-router';
import type { FallbackRender } from '@sentry/tanstackstart-react';
import { Button } from '@/components/ui/button';

export const ErrorFallback: FallbackRender = ({ resetError }) => {
  const navigate = useNavigate();

  // reset must run after navigate resolves: navigate() is async, and resetError() remounts children
  // immediately, so resetting first would remount straight back into the still-crashing route
  const goHome = () => void navigate({ to: '/' }).then(resetError);

  return (
    <div className="flex flex-col items-center justify-center px-4 pt-4 text-center md:pt-8">
      <div className="mx-auto max-w-3xl">
        <h1 className="mb-2 text-3xl font-bold tracking-tight md:mb-4 md:text-6xl">Something went wrong</h1>

        <p className="mb-4 max-w-2xl text-base text-muted-foreground md:mb-6 md:text-xl">
          An unexpected error occurred. Please try again.
        </p>

        <div className="flex justify-center gap-2">
          <Button variant="outline" onClick={resetError}>
            Try again
          </Button>

          <Button onClick={goHome}>Go back home</Button>
        </div>
      </div>
    </div>
  );
};
