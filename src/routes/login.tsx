import { createFileRoute, redirect } from '@tanstack/react-router';
import { getIsomorphicSession } from '@/services/auth';
import { pageHead } from '@/utils/page';
import { LoginPage } from '@/features/auth/pages/login-page';

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
