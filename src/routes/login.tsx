import { useState } from 'react';
import { createFileRoute, redirect } from '@tanstack/react-router';
import { GoogleLoginButton } from '@/components/google-login-button';
import { LoginForm } from '@/components/login-form';
import { RegisterForm } from '@/components/register-form';
import { Button } from '@/components/ui/button';
import { getAuthProviders, getIsomorphicSession } from '@/services/auth';
import { pageHead } from '@/utils/page';

export const Route = createFileRoute('/login')({
  head: () => pageHead('Log in'),
  beforeLoad: async () => {
    const session = await getIsomorphicSession();

    if (session) {
      throw redirect({ to: '/' });
    }
  },
  loader: () => getAuthProviders(),
  component: LoginPage,
});

function LoginPage() {
  const providers = Route.useLoaderData();
  const [isRegister, setIsRegister] = useState(false);

  return (
    <div className="flex flex-1 flex-col items-center justify-center px-4 text-center">
      <h1 className="mb-4 text-3xl font-bold tracking-tight md:mb-6 md:text-6xl">
        {isRegister ? 'Sign up' : 'Log in'}
      </h1>

      <p className="mb-6 max-w-2xl text-base text-muted-foreground md:mb-8 md:text-xl">
        Sign in to track your progress and pick up where you left off.
      </p>

      <div className="flex w-full max-w-sm flex-col items-center gap-4">
        {providers.includes('local') && (
          <>
            {isRegister ? <RegisterForm /> : <LoginForm />}

            <Button type="button" variant="link" onClick={() => setIsRegister((value) => !value)}>
              {isRegister ? 'Already have an account? Log in' : 'No account yet? Sign up'}
            </Button>
          </>
        )}

        {providers.length > 1 && (
          <div className="flex w-full items-center gap-3 text-sm text-muted-foreground">
            <div className="h-px flex-1 bg-border" />
            or
            <div className="h-px flex-1 bg-border" />
          </div>
        )}

        {providers.includes('google') && <GoogleLoginButton />}
      </div>
    </div>
  );
}
