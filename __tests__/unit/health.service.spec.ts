import { describe, it, expect } from 'vitest';
import { getHealth } from '@/server/health/health.service';

describe('health.service', () => {
  describe('getHealth', () => {
    it('returns ok: true', () => {
      expect(getHealth()).toEqual({ ok: true });
    });
  });
});
