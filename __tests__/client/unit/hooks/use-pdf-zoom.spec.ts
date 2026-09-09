import { act, cleanup, renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { usePdfZoom } from '@/hooks/use-pdf-zoom';

const ZOOM_STORAGE_KEY = 'pdf-zoom';

describe('usePdfZoom', () => {
  afterEach(() => {
    cleanup();
    localStorage.clear();
  });

  it('defaults to 100% zoom when nothing is stored', () => {
    const { result } = renderHook(() => usePdfZoom());

    expect(result.current.zoomLevel).toBe(1);
  });

  it('restores a stored zoom level on mount', () => {
    localStorage.setItem(ZOOM_STORAGE_KEY, '1.75');

    const { result } = renderHook(() => usePdfZoom());

    expect(result.current.zoomLevel).toBe(1.75);
  });

  it('clamps a stored zoom level outside the allowed range', () => {
    localStorage.setItem(ZOOM_STORAGE_KEY, '5');

    const { result } = renderHook(() => usePdfZoom());

    expect(result.current.zoomLevel).toBe(2.5);
  });

  it('clamps a stored zero to the minimum zoom instead of falling back to the default', () => {
    localStorage.setItem(ZOOM_STORAGE_KEY, '0');

    const { result } = renderHook(() => usePdfZoom());

    expect(result.current.zoomLevel).toBe(0.5);
  });

  it('falls back to the default zoom when the stored value is not a number', () => {
    localStorage.setItem(ZOOM_STORAGE_KEY, 'not-a-number');

    const { result } = renderHook(() => usePdfZoom());

    expect(result.current.zoomLevel).toBe(1);
  });

  it('persists zoom changes to localStorage', () => {
    const { result } = renderHook(() => usePdfZoom());

    act(() => result.current.zoomIn());

    expect(localStorage.getItem(ZOOM_STORAGE_KEY)).toBe('1.25');
  });
});
