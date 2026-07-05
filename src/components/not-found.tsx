import { type FC } from 'react';
import { Link } from '@tanstack/react-router';
import { Button } from '@/components/ui/button';

export const NotFound: FC = () => {
  return (
    <div className="flex flex-col items-center justify-center px-4 pt-4 text-center md:pt-8">
      <h1 className="mb-4 text-3xl font-bold tracking-tight md:mb-6 md:text-6xl">404</h1>

      <p className="mb-6 max-w-2xl text-base text-muted-foreground md:mb-8 md:text-xl">
        The page you are looking for doesn't exist.
      </p>

      <Button asChild>
        <Link to="/">Go back home</Link>
      </Button>
    </div>
  );
};
