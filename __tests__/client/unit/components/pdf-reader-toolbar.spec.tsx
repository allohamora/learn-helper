import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { PdfReaderToolbar } from '@/components/pdf-reader-toolbar';

describe('PdfReaderToolbar', () => {
  afterEach(() => {
    cleanup();
  });

  it('submits the typed page on blur, not just on Enter', () => {
    const onGoToPage = vi.fn();
    render(<PdfReaderToolbar currentPage={1} totalPages={5} onGoToPage={onGoToPage} />);

    const input = screen.getByRole('textbox', { name: 'Page number' });
    fireEvent.change(input, { target: { value: '3' } });
    fireEvent.blur(input);

    expect(onGoToPage).toHaveBeenCalledWith(3);
  });

  it('reverts to the current page and does not navigate on a non-integer input', () => {
    const onGoToPage = vi.fn();
    render(<PdfReaderToolbar currentPage={2} totalPages={5} onGoToPage={onGoToPage} />);

    const input = screen.getByRole('textbox', { name: 'Page number' }) as HTMLInputElement;
    fireEvent.change(input, { target: { value: 'abc' } });
    fireEvent.keyDown(input, { key: 'Enter' });

    expect(onGoToPage).not.toHaveBeenCalled();
    expect(input.value).toBe('2');
  });

  it('does not navigate when the input is submitted empty', () => {
    const onGoToPage = vi.fn();
    render(<PdfReaderToolbar currentPage={2} totalPages={5} onGoToPage={onGoToPage} />);

    const input = screen.getByRole('textbox', { name: 'Page number' }) as HTMLInputElement;
    fireEvent.change(input, { target: { value: '' } });
    fireEvent.keyDown(input, { key: 'Enter' });

    expect(onGoToPage).not.toHaveBeenCalled();
    expect(input.value).toBe('');
  });

  it('resyncs the input when currentPage changes externally, e.g. from scrolling', () => {
    const onGoToPage = vi.fn();
    const { rerender } = render(<PdfReaderToolbar currentPage={1} totalPages={5} onGoToPage={onGoToPage} />);

    const input = screen.getByRole('textbox', { name: 'Page number' }) as HTMLInputElement;
    expect(input.value).toBe('1');

    rerender(<PdfReaderToolbar currentPage={4} totalPages={5} onGoToPage={onGoToPage} />);

    expect(input.value).toBe('4');
  });

  it('discards an in-progress, uncommitted edit when currentPage changes externally', () => {
    const onGoToPage = vi.fn();
    const { rerender } = render(<PdfReaderToolbar currentPage={1} totalPages={5} onGoToPage={onGoToPage} />);

    const input = screen.getByRole('textbox', { name: 'Page number' }) as HTMLInputElement;
    fireEvent.change(input, { target: { value: '99' } }); // typed but never submitted

    rerender(<PdfReaderToolbar currentPage={2} totalPages={5} onGoToPage={onGoToPage} />);

    expect(input.value).toBe('2');
  });
});
