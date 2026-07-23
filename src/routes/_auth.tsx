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
  return (
    <>
      <Header />
      <main className="container my-4">
        <Outlet />
      </main>
      <Footer />
    </>
  );
}
