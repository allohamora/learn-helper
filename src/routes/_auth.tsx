import { Outlet, createFileRoute, redirect } from '@tanstack/react-router';
import { Footer } from '@/components/footer';
import { Header } from '@/components/header';
import { getSession } from '@/server/auth/auth.session';

export const Route = createFileRoute('/_auth')({
  beforeLoad: async () => {
    const session = await getSession();

    if (!session) {
      throw redirect({ to: '/login' });
    }

    return { session };
  },
  component: AuthLayout,
});

function AuthLayout() {
  return (
    <>
      <Header />
      <main className="container mt-4 mb-4">
        <Outlet />
      </main>
      <Footer />
    </>
  );
}
