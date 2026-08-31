import type { FC } from 'react';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useSelectionFloating } from '@/hooks/use-selection-floating';

// happy-dom has no real layout engine, so getBoundingClientRect() always resolves to zeros - actual
// on-screen placement (flip/shift/offset math) isn't verifiable here and is covered manually instead.
// This suite scopes down to what happy-dom can verify for real: the virtual reference is bound to the
// live selection Range, and the open/dismiss/mount lifecycle behaves correctly.

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  range: Range | null;
};

const TestPanel: FC<Props> = (props) => {
  // gapPx only affects on-screen placement, which happy-dom can't verify anyway (see above) - a
  // fixed value keeps every render call below focused on what this suite actually covers.
  const { refs, isMounted, getFloatingProps } = useSelectionFloating({ ...props, gapPx: 8 });
  if (!isMounted) return null;

  return (
    // eslint-disable-next-line react-hooks/refs -- see the matching comment in translation-popover.tsx
    <div data-testid="floating" ref={refs.setFloating} {...getFloatingProps()}>
      floating
    </div>
  );
};

const makeRange = (text: string): Range => {
  const paragraph = document.createElement('p');
  paragraph.textContent = text;
  document.body.appendChild(paragraph);

  const range = document.createRange();
  range.setStart(paragraph.firstChild!, 0);
  range.setEnd(paragraph.firstChild!, text.length);
  return range;
};

describe('useSelectionFloating (fine pointer / mouse)', () => {
  let matchMediaSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    matchMediaSpy = vi.spyOn(window, 'matchMedia').mockReturnValue({
      matches: false, // '(pointer: coarse)' doesn't match -> fine pointer branch
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    } as unknown as MediaQueryList);
  });

  afterEach(() => {
    matchMediaSpy.mockRestore();
    cleanup();
    document.body.innerHTML = '';
  });

  it('binds the virtual reference to the range and delegates rect reads to it', async () => {
    const range = makeRange('hello world');
    const getBoundingClientRect = vi.spyOn(range, 'getBoundingClientRect');

    render(<TestPanel open={true} onOpenChange={vi.fn()} range={range} />);

    expect(screen.getByTestId('floating')).toBeTruthy();
    // autoUpdate computes the initial position asynchronously (a microtask/rAF after mount), not
    // synchronously within render - wait for it rather than asserting immediately.
    await waitFor(() => expect(getBoundingClientRect).toHaveBeenCalled());
  });

  it('re-binds the virtual reference when the range changes, without a stale close', () => {
    const first = makeRange('first selection');
    const second = makeRange('second selection');
    const onOpenChange = vi.fn();

    const { rerender } = render(<TestPanel open={true} onOpenChange={onOpenChange} range={first} />);
    expect(screen.getByTestId('floating')).toBeTruthy();

    const secondRect = vi.spyOn(second, 'getBoundingClientRect');
    rerender(<TestPanel open={true} onOpenChange={onOpenChange} range={second} />);

    expect(screen.getByTestId('floating')).toBeTruthy();
    expect(onOpenChange).not.toHaveBeenCalled();
    expect(secondRect).not.toHaveBeenCalled(); // not read until something actually asks for the rect
  });

  it('stays mounted while open, and calls onOpenChange(false) on an outside pointerdown', () => {
    const range = makeRange('hello world');
    const onOpenChange = vi.fn();

    render(<TestPanel open={true} onOpenChange={onOpenChange} range={range} />);
    expect(screen.getByTestId('floating')).toBeTruthy();

    // A mouse dismisses on pointerdown (Floating UI's own default), not click - see the comment in
    // use-selection-floating.ts on why fine pointers don't need the click-based workaround touch does.
    fireEvent.pointerDown(document.body);

    expect(onOpenChange).toHaveBeenCalledWith(false, expect.anything(), 'outside-press');
  });

  it('dismisses immediately on the pointerdown that starts a fresh drag-selection elsewhere on the page', () => {
    const range = makeRange('hello world');
    const onOpenChange = vi.fn();
    const other = document.createElement('p');
    other.textContent = 'a different paragraph';
    document.body.appendChild(other);

    render(<TestPanel open={true} onOpenChange={onOpenChange} range={range} />);

    // Dismissing on pointerdown means a mouse drag-selection's own terminal click, wherever it ends up,
    // never has to be told apart from a genuine dismiss press - the old popover is already gone before
    // the drag even starts.
    fireEvent.pointerDown(other);
    fireEvent.click(other);

    expect(onOpenChange).toHaveBeenCalledTimes(1);
    expect(onOpenChange).toHaveBeenCalledWith(false, expect.anything(), 'outside-press');

    other.remove();
  });

  it('does not close on a press inside the floating panel itself', () => {
    const range = makeRange('hello world');
    const onOpenChange = vi.fn();

    render(<TestPanel open={true} onOpenChange={onOpenChange} range={range} />);
    fireEvent.pointerDown(screen.getByTestId('floating'));

    expect(onOpenChange).not.toHaveBeenCalled();
  });

  it('does not dismiss or re-read the reference rect on a scroll, so it survives the PDF reader scrolling past and back', () => {
    const range = makeRange('hello world');
    const onOpenChange = vi.fn();
    const getBoundingClientRect = vi.spyOn(range, 'getBoundingClientRect');

    render(<TestPanel open={true} onOpenChange={onOpenChange} range={range} />);
    getBoundingClientRect.mockClear();

    fireEvent.scroll(window);

    expect(onOpenChange).not.toHaveBeenCalled();
    expect(getBoundingClientRect).not.toHaveBeenCalled();
    expect(screen.getByTestId('floating')).toBeTruthy();
  });

  it('unmounts once open becomes false', async () => {
    const range = makeRange('hello world');
    const { rerender } = render(<TestPanel open={true} onOpenChange={vi.fn()} range={range} />);
    expect(screen.getByTestId('floating')).toBeTruthy();

    rerender(<TestPanel open={false} onOpenChange={vi.fn()} range={range} />);

    await waitFor(() => expect(screen.queryByTestId('floating')).toBeNull());
  });
});

describe('useSelectionFloating (coarse pointer / touch)', () => {
  let matchMediaSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    matchMediaSpy = vi.spyOn(window, 'matchMedia').mockReturnValue({
      matches: true, // '(pointer: coarse)' matches -> touch branch
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    } as unknown as MediaQueryList);
  });

  afterEach(() => {
    matchMediaSpy.mockRestore();
    cleanup();
    document.body.innerHTML = '';
  });

  it('does not dismiss on a bare outside pointerdown, so starting a touch-scroll outside the panel does not close it', () => {
    const range = makeRange('hello world');
    const onOpenChange = vi.fn();

    render(<TestPanel open={true} onOpenChange={onOpenChange} range={range} />);

    // A drag/scroll gesture starts with the same pointerdown a dismiss tap does, but - unlike a tap -
    // it suppresses the click that would otherwise fire at gesture-end. Listening for outside click
    // rather than outside pointerdown is what lets a scroll started outside the panel pass through.
    fireEvent.pointerDown(document.body);

    expect(onOpenChange).not.toHaveBeenCalled();
  });

  it('dismisses on an outside click, e.g. a genuine tap that (unlike a scroll) does fire one', () => {
    const range = makeRange('hello world');
    const onOpenChange = vi.fn();

    render(<TestPanel open={true} onOpenChange={onOpenChange} range={range} />);

    fireEvent.click(document.body);

    expect(onOpenChange).toHaveBeenCalledWith(false, expect.anything(), 'outside-press');
  });

  it('does not close on a click inside the floating panel itself', () => {
    const range = makeRange('hello world');
    const onOpenChange = vi.fn();

    render(<TestPanel open={true} onOpenChange={onOpenChange} range={range} />);
    fireEvent.click(screen.getByTestId('floating'));

    expect(onOpenChange).not.toHaveBeenCalled();
  });
});
