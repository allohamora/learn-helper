import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { PdfReaderToolbar } from '@/components/pdf-reader-toolbar';

const zoomProps = {
  disabled: false,
  zoomLevel: 1,
  canZoomIn: true,
  canZoomOut: true,
  onZoomIn: vi.fn(),
  onZoomOut: vi.fn(),
};

describe('PdfReaderToolbar', () => {
  afterEach(() => {
    cleanup();
  });

  it('submits the typed page on blur, not just on Enter', () => {
    const onGoToPage = vi.fn();
    render(<PdfReaderToolbar currentPage={1} totalPages={5} onGoToPage={onGoToPage} {...zoomProps} />);

    const input = screen.getByRole('textbox', { name: 'Page number' });
    fireEvent.change(input, { target: { value: '3' } });
    fireEvent.blur(input);

    expect(onGoToPage).toHaveBeenCalledWith(3);
  });

  it('reverts to the current page and does not navigate on a non-integer input', () => {
    const onGoToPage = vi.fn();
    render(<PdfReaderToolbar currentPage={2} totalPages={5} onGoToPage={onGoToPage} {...zoomProps} />);

    const input = screen.getByRole('textbox', { name: 'Page number' }) as HTMLInputElement;
    fireEvent.change(input, { target: { value: 'abc' } });
    fireEvent.keyDown(input, { key: 'Enter' });

    expect(onGoToPage).not.toHaveBeenCalled();
    expect(input.value).toBe('2');
  });

  it('does not navigate when the input is submitted empty', () => {
    const onGoToPage = vi.fn();
    render(<PdfReaderToolbar currentPage={2} totalPages={5} onGoToPage={onGoToPage} {...zoomProps} />);

    const input = screen.getByRole('textbox', { name: 'Page number' }) as HTMLInputElement;
    fireEvent.change(input, { target: { value: '' } });
    fireEvent.keyDown(input, { key: 'Enter' });

    expect(onGoToPage).not.toHaveBeenCalled();
    expect(input.value).toBe('');
  });

  it('resyncs the input when currentPage changes externally, e.g. from scrolling', () => {
    const onGoToPage = vi.fn();
    const { rerender } = render(
      <PdfReaderToolbar currentPage={1} totalPages={5} onGoToPage={onGoToPage} {...zoomProps} />,
    );

    const input = screen.getByRole('textbox', { name: 'Page number' }) as HTMLInputElement;
    expect(input.value).toBe('1');

    rerender(<PdfReaderToolbar currentPage={4} totalPages={5} onGoToPage={onGoToPage} {...zoomProps} />);

    expect(input.value).toBe('4');
  });

  it('discards an in-progress, uncommitted edit when currentPage changes externally', () => {
    const onGoToPage = vi.fn();
    const { rerender } = render(
      <PdfReaderToolbar currentPage={1} totalPages={5} onGoToPage={onGoToPage} {...zoomProps} />,
    );

    const input = screen.getByRole('textbox', { name: 'Page number' }) as HTMLInputElement;
    fireEvent.change(input, { target: { value: '99' } }); // typed but never submitted

    rerender(<PdfReaderToolbar currentPage={2} totalPages={5} onGoToPage={onGoToPage} {...zoomProps} />);

    expect(input.value).toBe('2');
  });

  it('shows the zoom percentage and calls onZoomIn/onZoomOut on click', () => {
    const onGoToPage = vi.fn();
    const onZoomIn = vi.fn();
    const onZoomOut = vi.fn();
    render(
      <PdfReaderToolbar
        currentPage={1}
        totalPages={5}
        onGoToPage={onGoToPage}
        {...zoomProps}
        zoomLevel={1.5}
        onZoomIn={onZoomIn}
        onZoomOut={onZoomOut}
      />,
    );

    expect(screen.queryByText('150%')).not.toBeNull();

    fireEvent.click(screen.getByRole('button', { name: 'Zoom in' }));
    expect(onZoomIn).toHaveBeenCalledOnce();

    fireEvent.click(screen.getByRole('button', { name: 'Zoom out' }));
    expect(onZoomOut).toHaveBeenCalledOnce();
  });

  it('disables the zoom buttons at the min/max bounds', () => {
    const onGoToPage = vi.fn();
    render(
      <PdfReaderToolbar
        currentPage={1}
        totalPages={5}
        onGoToPage={onGoToPage}
        {...zoomProps}
        canZoomIn={false}
        canZoomOut={false}
      />,
    );

    expect((screen.getByRole('button', { name: 'Zoom in' }) as HTMLButtonElement).disabled).toBe(true);
    expect((screen.getByRole('button', { name: 'Zoom out' }) as HTMLButtonElement).disabled).toBe(true);
  });

  it('disables the page input and zoom buttons while the document is still loading', () => {
    const onGoToPage = vi.fn();
    render(<PdfReaderToolbar currentPage={1} totalPages={5} onGoToPage={onGoToPage} {...zoomProps} disabled />);

    expect((screen.getByRole('textbox', { name: 'Page number' }) as HTMLInputElement).disabled).toBe(true);
    expect((screen.getByRole('button', { name: 'Zoom in' }) as HTMLButtonElement).disabled).toBe(true);
    expect((screen.getByRole('button', { name: 'Zoom out' }) as HTMLButtonElement).disabled).toBe(true);
  });
});
