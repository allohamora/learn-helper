import { describe, expect, it } from 'vitest';
import { hashPassword } from 'better-auth/crypto';
import { app } from '@/server/api';
import { db } from '@/server/db/db.service';
import { account, user } from '@/server/db/db.schema';

const post = (path: string, body: object) =>
  app.request(`/api/auth/${path}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', origin: 'http://localhost:3000' },
    body: JSON.stringify(body),
  });

describe('auth', () => {
  describe('email and password', () => {
    it('signs up and signs in an allowed user', async () => {
      const credentials = { email: 'example@gmail.com', password: 'password-1234' };

      const signUp = await post('sign-up/email', { ...credentials, name: 'Example' });
      const signIn = await post('sign-in/email', credentials);

      expect(signUp.status).toBe(200);
      expect(signIn.status).toBe(200);
      expect(signIn.headers.get('set-cookie')).toContain('better-auth.session_token');
    });

    it('rejects sign up for a user that is not allowed', async () => {
      const res = await post('sign-up/email', {
        email: 'stranger@example.com',
        password: 'password-1234',
        name: 'Stranger',
      });

      expect(res.status).toBe(403);
    });

    it('rejects sign in for an existing user that is not allowed', async () => {
      const credentials = { email: 'stranger@example.com', password: 'password-1234' };
      await db.insert(user).values({ id: 'stranger', name: 'Stranger', email: credentials.email });
      await db.insert(account).values({
        id: 'stranger-account',
        accountId: 'stranger',
        providerId: 'credential',
        userId: 'stranger',
        password: await hashPassword(credentials.password),
      });

      const res = await post('sign-in/email', credentials);

      expect(res.status).toBe(403);
      expect(res.headers.get('set-cookie')).toBeNull();
    });
  });
});
