import { cleanup, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useSelection } from '@/hooks/use-selection';
import { getContext } from '@/utils/selection';

const setSelection = (node: Node, startOffset: number, endOffset: number) => {
  const range = document.createRange();
  range.setStart(node, startOffset);
  range.setEnd(node, endOffset);

  const selection = window.getSelection()!;
  selection.removeAllRanges();
  selection.addRange(range);

  document.dispatchEvent(new Event('selectionchange'));
};

const collapseSelection = () => {
  window.getSelection()?.removeAllRanges();
  document.dispatchEvent(new Event('selectionchange'));
};

const endPointerSelection = () => document.dispatchEvent(new Event('pointerup'));
const endKeyboardSelection = () => document.dispatchEvent(new Event('keyup'));

describe('useSelection', () => {
  let paragraph: HTMLParagraphElement;

  beforeEach(() => {
    paragraph = document.createElement('p');
    paragraph.textContent = 'Some selectable text here.';
    document.body.appendChild(paragraph);
  });

  afterEach(() => {
    collapseSelection();
    paragraph.remove();
    cleanup();
  });

  it('does not call the callback when there is no selection yet', () => {
    const callback = vi.fn();
    renderHook(() => useSelection(callback));

    endPointerSelection();

    expect(callback).not.toHaveBeenCalled();
  });

  it('calls the callback with the selection once the pointer gesture ends', () => {
    const callback = vi.fn();
    renderHook(() => useSelection(callback));

    setSelection(paragraph.firstChild!, 0, 4);
    endPointerSelection();

    expect(callback).toHaveBeenCalledTimes(1);
    expect(callback.mock.calls[0][0].toString()).toBe('Some');
  });

  it('calls the callback with the selection once a keyboard selection ends', () => {
    const callback = vi.fn();
    renderHook(() => useSelection(callback));

    setSelection(paragraph.firstChild!, 0, 9);
    endKeyboardSelection();

    expect(callback).toHaveBeenCalledTimes(1);
    expect(callback.mock.calls[0][0].toString()).toBe('Some sele');
  });

  it('does not call the callback while the selection is still changing, only once it stops', () => {
    const callback = vi.fn();
    renderHook(() => useSelection(callback));

    setSelection(paragraph.firstChild!, 0, 4);
    setSelection(paragraph.firstChild!, 0, 9);
    setSelection(paragraph.firstChild!, 0, 15);
    expect(callback).not.toHaveBeenCalled();

    endPointerSelection();

    expect(callback).toHaveBeenCalledTimes(1);
    expect(callback.mock.calls[0][0].toString()).toBe('Some selectable');
  });

  it('does not call the callback when the selection is cleared', () => {
    const callback = vi.fn();
    renderHook(() => useSelection(callback));

    collapseSelection();
    endPointerSelection();

    expect(callback).not.toHaveBeenCalled();
  });

  it('does not call the callback for a whitespace-only selection', () => {
    const callback = vi.fn();
    const spacer = document.createElement('p');
    spacer.textContent = '    ';
    document.body.appendChild(spacer);

    renderHook(() => useSelection(callback));

    setSelection(spacer.firstChild!, 0, 4);
    endPointerSelection();

    expect(callback).not.toHaveBeenCalled();

    spacer.remove();
  });

  it('subscribes once on mount and unsubscribes on unmount, without resubscribing on rerender', () => {
    const addSpy = vi.spyOn(document, 'addEventListener');
    const removeSpy = vi.spyOn(document, 'removeEventListener');

    const { rerender, unmount } = renderHook(({ callback }) => useSelection(callback), {
      initialProps: { callback: vi.fn() },
    });

    expect(addSpy).toHaveBeenCalledTimes(3);
    expect(addSpy).toHaveBeenCalledWith('pointerup', expect.any(Function));
    expect(addSpy).toHaveBeenCalledWith('keyup', expect.any(Function));
    expect(addSpy).toHaveBeenCalledWith('selectionchange', expect.any(Function));

    rerender({ callback: vi.fn() });
    expect(addSpy).toHaveBeenCalledTimes(3);
    expect(removeSpy).not.toHaveBeenCalled();

    unmount();
    expect(removeSpy).toHaveBeenCalledTimes(3);

    addSpy.mockRestore();
    removeSpy.mockRestore();
  });

  it('always calls the latest callback closure, even without a deps array', () => {
    const first = vi.fn();
    const second = vi.fn();

    const { rerender } = renderHook(({ callback }) => useSelection(callback), { initialProps: { callback: first } });

    rerender({ callback: second });

    setSelection(paragraph.firstChild!, 0, 4);
    endPointerSelection();

    expect(first).not.toHaveBeenCalled();
    expect(second).toHaveBeenCalledTimes(1);
  });

  it('calls the callback once the selection settles via selectionchange alone, without a pointerup', () => {
    // Simulates Android: dragging a selection handle updates the Selection via selectionchange but
    // never dispatches a pointerup to the document.
    vi.useFakeTimers();
    const callback = vi.fn();
    renderHook(() => useSelection(callback));

    setSelection(paragraph.firstChild!, 0, 4);
    expect(callback).not.toHaveBeenCalled();

    vi.runAllTimers();

    expect(callback).toHaveBeenCalledTimes(1);
    expect(callback.mock.calls[0][0].toString()).toBe('Some');
    vi.useRealTimers();
  });

  it('debounces rapid selectionchange events into a single callback call', () => {
    vi.useFakeTimers();
    const callback = vi.fn();
    renderHook(() => useSelection(callback));

    setSelection(paragraph.firstChild!, 0, 4);
    vi.advanceTimersByTime(100);
    setSelection(paragraph.firstChild!, 0, 9);
    vi.advanceTimersByTime(100);
    setSelection(paragraph.firstChild!, 0, 15);
    vi.runAllTimers();

    expect(callback).toHaveBeenCalledTimes(1);
    expect(callback.mock.calls[0][0].toString()).toBe('Some selectable');
    vi.useRealTimers();
  });

  it('combines with getContext to resolve the word window around a settled selection', () => {
    paragraph.textContent = 'First sentence here. Second sentence here. Third sentence here.';

    const contexts: (string | null)[] = [];
    renderHook(() =>
      useSelection((selection) => {
        const range = selection.getRangeAt(0);
        const { before, after } = getContext(range);
        contexts.push(before, after);
      }),
    );

    // selects "Second" only, inside the middle sentence
    const text = paragraph.textContent!;
    const start = text.indexOf('Second');
    setSelection(paragraph.firstChild!, start, start + 'Second'.length);
    endPointerSelection();

    expect(contexts).toEqual(['First sentence here.', 'sentence here. Third sentence here.']);
  });
});
