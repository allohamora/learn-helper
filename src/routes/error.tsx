import { createFileRoute, Link } from '@tanstack/react-router';
import { Button } from '@/components/ui/button';

export const Route = createFileRoute('/error')({
  validateSearch: (search: Record<string, unknown>) => ({
    error: typeof search.error === 'string' ? search.error : undefined,
  }),
  component: ErrorPage,
});

function ErrorPage() {
  const { error } = Route.useSearch();

  return (
    <div className="flex flex-1 flex-col items-center justify-center px-4 text-center">
      <h1 className="mb-4 text-3xl font-bold tracking-tight md:mb-6 md:text-6xl">Authentication error</h1>

      <p className="mb-6 max-w-2xl text-base text-muted-foreground md:mb-8 md:text-xl">
        {error ? error : 'Something went wrong while signing you in.'}
      </p>

      <Button asChild>
        <Link to="/">Go back home</Link>
      </Button>
    </div>
  );
}
