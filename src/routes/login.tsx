import { createFileRoute, redirect } from '@tanstack/react-router';
import { Button } from '@/components/ui/button';
import { authClient, getIsomorphicSession } from '@/services/auth';
import { pageHead } from '@/utils/page';

export const Route = createFileRoute('/login')({
  head: () => pageHead('Log in'),
  beforeLoad: async () => {
    const session = await getIsomorphicSession();

    if (session) {
      throw redirect({ to: '/' });
    }
  },
  component: LoginPage,
});

function LoginPage() {
  return (
    <div className="flex flex-1 flex-col items-center justify-center px-4 text-center">
      <h1 className="mb-4 text-3xl font-bold tracking-tight md:mb-6 md:text-6xl">Log in</h1>

      <p className="mb-6 max-w-2xl text-base text-muted-foreground md:mb-8 md:text-xl">
        Sign in to track your progress and pick up where you left off.
      </p>

      <Button onClick={() => void authClient.signIn.social({ provider: 'google', callbackURL: '/' })}>
        Continue with Google
      </Button>
    </div>
  );
}
