import { describe, expect, it } from 'vitest';
import { routeHead } from '@/utils/route';

describe('route utilities', () => {
  describe('routeHead', () => {
    it('builds TanStack route head metadata with the application name', () => {
      expect(routeHead('Home')).toEqual({ meta: [{ title: 'Home | Learn Helper' }] });
    });
  });
});
