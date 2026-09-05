import { cleanup, fireEvent, renderHook } from '@testing-library/react';
import { type MockInstance, afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useVisibleDuration } from '@/hooks/use-visible-duration';

const BASE_NOW = 1_000_000;

const setVisibility = (state: 'visible' | 'hidden') => {
  Object.defineProperty(document, 'visibilityState', { value: state, configurable: true });
  fireEvent(document, new Event('visibilitychange'));
};

describe('useVisibleDuration', () => {
  const originalVisibilityState = Object.getOwnPropertyDescriptor(document, 'visibilityState');
  let dateNowSpy: MockInstance<() => number>;

  beforeEach(() => {
    dateNowSpy = vi.spyOn(Date, 'now').mockReturnValue(BASE_NOW);
    Object.defineProperty(document, 'visibilityState', { value: 'visible', configurable: true });
  });

  afterEach(() => {
    cleanup();
    dateNowSpy.mockRestore();
    if (originalVisibilityState) Object.defineProperty(document, 'visibilityState', originalVisibilityState);
  });

  it('accumulates elapsed time while mounted visible', () => {
    const { result } = renderHook(() => useVisibleDuration());

    dateNowSpy.mockReturnValue(BASE_NOW + 5_000);

    expect(result.current.takeElapsedMs()).toBe(5_000);
  });

  it('does not accumulate time while mounted hidden, until the tab becomes visible', () => {
    Object.defineProperty(document, 'visibilityState', { value: 'hidden', configurable: true });
    const { result } = renderHook(() => useVisibleDuration());

    dateNowSpy.mockReturnValue(BASE_NOW + 5_000);
    expect(result.current.takeElapsedMs()).toBe(0);

    setVisibility('visible');
    dateNowSpy.mockReturnValue(BASE_NOW + 8_000);
    expect(result.current.takeElapsedMs()).toBe(3_000);
  });

  it('excludes time spent while the tab is hidden', () => {
    const { result } = renderHook(() => useVisibleDuration());

    dateNowSpy.mockReturnValue(BASE_NOW + 3 * 60_000);
    setVisibility('hidden');

    dateNowSpy.mockReturnValue(BASE_NOW + 60 * 60_000);
    expect(result.current.takeElapsedMs()).toBe(3 * 60_000);
  });

  it('sums multiple visible segments across a hidden gap, rather than only counting the latest one', () => {
    const { result } = renderHook(() => useVisibleDuration());

    dateNowSpy.mockReturnValue(BASE_NOW + 3 * 60_000);
    setVisibility('hidden');

    dateNowSpy.mockReturnValue(BASE_NOW + 30 * 60_000);
    setVisibility('visible');

    dateNowSpy.mockReturnValue(BASE_NOW + 33 * 60_000);
    expect(result.current.takeElapsedMs()).toBe(6 * 60_000);
  });

  it('sums every visible segment across several hidden/visible cycles before a single take', () => {
    const { result } = renderHook(() => useVisibleDuration());

    // visible 1min
    dateNowSpy.mockReturnValue(BASE_NOW + 60_000);
    setVisibility('hidden');

    // hidden for a while - excluded
    dateNowSpy.mockReturnValue(BASE_NOW + 10 * 60_000);
    setVisibility('visible');

    // visible 1min
    dateNowSpy.mockReturnValue(BASE_NOW + 11 * 60_000);
    setVisibility('hidden');

    // hidden again - excluded
    dateNowSpy.mockReturnValue(BASE_NOW + 40 * 60_000);
    setVisibility('visible');

    // visible 1min
    dateNowSpy.mockReturnValue(BASE_NOW + 41 * 60_000);

    expect(result.current.takeElapsedMs()).toBe(3 * 60_000);
  });

  it('resets the accumulator once taken', () => {
    const { result } = renderHook(() => useVisibleDuration());

    dateNowSpy.mockReturnValue(BASE_NOW + 5_000);
    expect(result.current.takeElapsedMs()).toBe(5_000);
    expect(result.current.takeElapsedMs()).toBe(0);
  });

  it('taking the duration while hidden does not throw or go negative, and stays excluded afterward', () => {
    const { result } = renderHook(() => useVisibleDuration());

    dateNowSpy.mockReturnValue(BASE_NOW + 2_000);
    setVisibility('hidden');

    expect(result.current.takeElapsedMs()).toBe(2_000);

    dateNowSpy.mockReturnValue(BASE_NOW + 10_000);
    expect(result.current.takeElapsedMs()).toBe(0);
  });

  it('peekElapsedMs does not clear the accumulator, unlike takeElapsedMs', () => {
    const { result } = renderHook(() => useVisibleDuration());

    dateNowSpy.mockReturnValue(BASE_NOW + 5_000);
    expect(result.current.peekElapsedMs()).toBe(5_000);
    expect(result.current.peekElapsedMs()).toBe(5_000);
  });

  it('commitElapsedMs removes only the committed amount, keeping time accumulated afterward', () => {
    const { result } = renderHook(() => useVisibleDuration());

    dateNowSpy.mockReturnValue(BASE_NOW + 5_000);
    const peeked = result.current.peekElapsedMs();
    expect(peeked).toBe(5_000);

    // More time elapses (e.g. the request is still in flight) before the commit happens.
    dateNowSpy.mockReturnValue(BASE_NOW + 8_000);
    result.current.commitElapsedMs(peeked);

    expect(result.current.peekElapsedMs()).toBe(3_000);
  });

  it('keeps a peeked duration queued when it is never committed, e.g. a failed request', () => {
    const { result } = renderHook(() => useVisibleDuration());

    dateNowSpy.mockReturnValue(BASE_NOW + 5_000);
    expect(result.current.peekElapsedMs()).toBe(5_000);

    // Simulate a failed flush: commitElapsedMs is never called, so the 5s isn't lost - it's still
    // there, plus whatever accumulates afterward.
    dateNowSpy.mockReturnValue(BASE_NOW + 9_000);
    expect(result.current.peekElapsedMs()).toBe(9_000);
  });

  it('registers the visibilitychange listener once on mount and removes it on unmount', () => {
    const addSpy = vi.spyOn(document, 'addEventListener');
    const removeSpy = vi.spyOn(document, 'removeEventListener');

    try {
      const { unmount, rerender } = renderHook(() => useVisibleDuration());
      rerender();

      expect(addSpy.mock.calls.filter(([type]) => type === 'visibilitychange')).toHaveLength(1);

      unmount();
      expect(removeSpy.mock.calls.filter(([type]) => type === 'visibilitychange')).toHaveLength(1);
    } finally {
      addSpy.mockRestore();
      removeSpy.mockRestore();
    }
  });
});
