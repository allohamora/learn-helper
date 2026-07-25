import { vitest } from 'vitest';
import type { auth as betterAuth } from '@/server/auth/auth.service';
import { afterEach, beforeEach } from 'vitest';
import { Exception } from '@/server/utils/exception.utils';

type User = typeof betterAuth.$Infer.Session.user;
type Session = typeof betterAuth.$Infer.Session.session;

const testUser: { user: User; session: Session } = {
  user: {
    id: 'mock-user-id',
    name: 'Mock User',
    email: 'mock@example.com',
    emailVerified: true,
    image: null as string | null | undefined,
    createdAt: new Date('2024-01-01'),
    updatedAt: new Date('2024-01-01'),
  },
  session: {
    id: 'mock-session-id',
    userId: 'mock-user-id',
    token: 'mock-token',
    expiresAt: new Date('2099-01-01'),
    ipAddress: null as string | null | undefined,
    userAgent: null as string | null | undefined,
    createdAt: new Date('2024-01-01'),
    updatedAt: new Date('2024-01-01'),
  },
};

const authMiddleware = vitest.fn();

export const auth = {
  unauthorized: () => {
    authMiddleware.mockImplementation(() => {
      throw Exception.unauthorized('No active session');
    });
  },
  authorized: (overrides: { user?: Partial<User>; session?: Partial<Session> } = {}) => {
    const data = {
      user: { ...testUser.user, ...overrides.user },
      session: { ...testUser.session, ...overrides.session },
    };

    authMiddleware.mockImplementation((c, next) => {
      c.set('user', data.user);
      c.set('session', data.session);

      return next();
    });
  },
};

beforeEach(() => {
  auth.authorized();
});

afterEach(() => {
  authMiddleware.mockRestore();
});

vitest.mock('@/server/auth/auth.middleware', () => ({
  authMiddleware,
}));
