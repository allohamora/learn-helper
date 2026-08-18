import { useEffect } from 'react';
import * as Sentry from '@sentry/tanstackstart-react';
import { Outlet, createFileRoute, redirect } from '@tanstack/react-router';
import { Header } from '@/components/header';
import { getIsomorphicSession } from '@/services/auth';

export const Route = createFileRoute('/_auth')({
  beforeLoad: async () => {
    const session = await getIsomorphicSession();

    if (!session) {
      throw redirect({ to: '/login' });
    }

    return { session };
  },
  component: AuthLayout,
});

function AuthLayout() {
  const { session } = Route.useRouteContext();

  useEffect(() => {
    Sentry.setUser({ id: session.user.id, email: session.user.email, username: session.user.name });
    Sentry.getFeedback()?.createWidget();

    return () => {
      Sentry.setUser(null);
      Sentry.getFeedback()?.remove();
    };
  }, [session.user.id, session.user.email, session.user.name]);

  return (
    <>
      <Header />
      <main className="container pb-6 md:pb-8">
        <Outlet />
      </main>
    </>
  );
}
