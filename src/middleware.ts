import { clerkMiddleware } from '@clerk/astro/server';

export const onRequest = clerkMiddleware((auth) => {
  const { isAuthenticated, redirectToSignIn } = auth();

  if (!isAuthenticated) {
    return redirectToSignIn();
  }
});
