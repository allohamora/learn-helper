import { describe, expect, it } from 'vitest';
import { APP_NAME, pageHead, pageTitle } from '@/utils/page';

describe('page utilities', () => {
  it('provides the application name for root metadata', () => {
    expect(APP_NAME).toBe('Learn Helper');
  });

  it('appends the application name to the page title', () => {
    expect(pageTitle('Home')).toBe('Home | Learn Helper');
  });

  it('builds TanStack route head metadata', () => {
    expect(pageHead('Home')).toEqual({ meta: [{ title: 'Home | Learn Helper' }] });
  });
});
