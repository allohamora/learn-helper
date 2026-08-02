import { feedback, setUser } from '@/instrument';
import { useEffect } from 'react';
import { Outlet, createFileRoute, redirect } from '@tanstack/react-router';
import { Footer } from '@/components/footer';
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
    setUser({ id: session.user.id, email: session.user.email, username: session.user.name });
    feedback?.createWidget();

    return () => {
      setUser(null);
      feedback?.remove();
    };
  }, [session.user.id, session.user.email, session.user.name]);

  return (
    <>
      <Header />
      <main className="container">
        <Outlet />
      </main>
      <Footer />
    </>
  );
}
