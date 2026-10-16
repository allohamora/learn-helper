import { createFileRoute, redirect } from '@tanstack/react-router';
import { getIsomorphicSession } from '@/services/auth';
import { routeHead } from '@/utils/route';
import { LoginPage } from '@/features/auth/pages/login-page';

export const Route = createFileRoute('/login')({
  head: () => routeHead('Log in'),
  beforeLoad: async () => {
    const session = await getIsomorphicSession();

    if (session) {
      throw redirect({ to: '/' });
    }
  },
  component: LoginPage,
});
