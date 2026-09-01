import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { TranslationPopover } from '@/components/translation-popover';

const setSelection = (node: Node, startOffset: number, endOffset: number) => {
  const range = document.createRange();
  range.setStart(node, startOffset);
  range.setEnd(node, endOffset);

  const selection = window.getSelection()!;
  selection.removeAllRanges();
  selection.addRange(range);

  document.dispatchEvent(new Event('selectionchange'));
};

const endPointerSelection = () => document.dispatchEvent(new Event('pointerup'));
const endKeySelection = () => document.dispatchEvent(new Event('keyup'));

describe('TranslationPopover (desktop)', () => {
  let matchMediaSpy: ReturnType<typeof vi.spyOn>;
  let paragraph: HTMLParagraphElement;

  beforeEach(() => {
    matchMediaSpy = vi.spyOn(window, 'matchMedia').mockReturnValue({
      matches: false, // '(pointer: coarse)' doesn't match -> desktop branch
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    } as unknown as MediaQueryList);

    paragraph = document.createElement('p');
    paragraph.textContent = 'Some selectable text here.';
    document.body.appendChild(paragraph);
  });

  afterEach(() => {
    matchMediaSpy.mockRestore();
    window.getSelection()?.removeAllRanges();
    paragraph.remove();
    cleanup();
  });

  it('shows the trigger button once a selection settles', async () => {
    render(<TranslationPopover />);

    setSelection(paragraph.firstChild!, 0, 4);
    endPointerSelection();

    expect(await screen.findByRole('button', { name: 'Translate selection' })).toBeTruthy();
  });

  it('keeps the selection alive through a trigger click, and shows the result panel', async () => {
    render(<TranslationPopover />);

    setSelection(paragraph.firstChild!, 0, 4);
    endPointerSelection();
    const trigger = await screen.findByRole('button', { name: 'Translate selection' });

    fireEvent.mouseDown(trigger);
    fireEvent.click(trigger);

    expect(await screen.findByText('Some')).toBeTruthy();
    expect(window.getSelection()?.isCollapsed).toBe(false);
    expect(window.getSelection()?.toString()).toBe('Some');
  });

  it('restores the original, un-expanded selection on trigger click, not the word-corrected one used for translation', async () => {
    render(<TranslationPopover />);

    // "om" sits strictly inside "Some" - correctRange expands this to the whole word for translation
    // purposes, but a native Copy afterward should still copy exactly what was dragged over.
    setSelection(paragraph.firstChild!, 1, 3);
    endPointerSelection();
    const trigger = await screen.findByRole('button', { name: 'Translate selection' });

    fireEvent.mouseDown(trigger);
    fireEvent.click(trigger);

    expect(await screen.findByText('Some')).toBeTruthy(); // translation still uses the corrected word
    await waitFor(() => expect(window.getSelection()?.toString()).toBe('om'));
  });

  it('still registers a shrunk selection even when correctRange maps both onto the same word', async () => {
    render(<TranslationPopover />);

    // Selecting all of "selectable" (offsets 5-15) then shrinking to just its first letter "s"
    // (offsets 5-6) corrects to the same "selectable" range both times - its start already sits at
    // the word's own edge, so only the end boundary re-expands. Comparing the corrected range alone
    // would read this as "nothing changed" and drop the update entirely.
    setSelection(paragraph.firstChild!, 5, 15);
    endPointerSelection();
    await screen.findByRole('button', { name: 'Translate selection' });

    setSelection(paragraph.firstChild!, 5, 6);
    endPointerSelection();
    // The trigger's accessible name is the same regardless of which text is selected, so
    // findByRole below would otherwise resolve immediately against the still-existing button from
    // the first selection rather than waiting for this second, RAF-deferred update to land.
    await new Promise((resolve) => requestAnimationFrame(resolve));
    const trigger = await screen.findByRole('button', { name: 'Translate selection' });

    fireEvent.mouseDown(trigger);
    fireEvent.click(trigger);

    expect(await screen.findByText('selectable')).toBeTruthy(); // translation still uses the whole word
    await waitFor(() => expect(window.getSelection()?.toString()).toBe('s'));
  });

  it('does not fall back to the trigger when a pointerup bubbles from inside the open result panel', async () => {
    render(<TranslationPopover />);

    setSelection(paragraph.firstChild!, 0, 4);
    endPointerSelection();
    const trigger = await screen.findByRole('button', { name: 'Translate selection' });

    fireEvent.mouseDown(trigger);
    fireEvent.click(trigger);
    const resultText = await screen.findByText('Some');

    // The underlying selection is still live at this point (previous test), so without the panel
    // stopping this from reaching useSelection's document-wide listener, this would read as a fresh
    // selection event and reset the panel back to the trigger button.
    fireEvent.pointerUp(resultText);

    expect(screen.queryByRole('button', { name: 'Translate selection' })).toBeNull();
    expect(screen.getByText('Some')).toBeTruthy();
  });

  it('ignores a re-detection of the same still-active selection while the result panel is open', async () => {
    render(<TranslationPopover />);

    setSelection(paragraph.firstChild!, 0, 4);
    endPointerSelection();
    const trigger = await screen.findByRole('button', { name: 'Translate selection' });

    fireEvent.mouseDown(trigger);
    fireEvent.click(trigger);
    await screen.findByText('Some');

    // Simulates the real-browser bug directly: something (a click inside the panel that a browser's
    // stopPropagation quirk lets through, a focus-triggered selectionchange, ...) causes useSelection
    // to re-fire for the exact same selection, dispatched straight at document so it bypasses this
    // component's own propagation guards entirely.
    endPointerSelection();

    // The dispatch above goes straight to document, outside any fireEvent/act wrapper, so the
    // resulting state update isn't guaranteed to have flushed yet - give it a moment before asserting
    // it did NOT happen, rather than risk a false pass from asserting too early.
    await new Promise((resolve) => setTimeout(resolve, 50));

    expect(screen.queryByRole('button', { name: 'Translate selection' })).toBeNull();
    expect(screen.getByText('Some')).toBeTruthy();
  });

  it('keeps a slow drag intact when the debounce path already opened the panel mid-gesture, before release', async () => {
    render(<TranslationPopover />);

    // Simulates a slow mouse drag that pauses while still held down: the debounced selectionchange
    // path settles and opens the panel before the mouse is ever released, with no pointerup involved.
    setSelection(paragraph.firstChild!, 0, 4);
    await new Promise((resolve) => setTimeout(resolve, 200));
    await screen.findByRole('button', { name: 'Translate selection' });

    // The drag now finally ends on the exact same, already-tracked range - since no pointerdown ever
    // occurred elsewhere on the page in between, nothing should have dismissed the panel or cleared
    // the selection along the way, even though isSameRange means the final pointerup is a no-op.
    endPointerSelection();

    expect(await screen.findByRole('button', { name: 'Translate selection' })).toBeTruthy();
    expect(window.getSelection()?.isCollapsed).toBe(false);
    expect(window.getSelection()?.toString()).toBe('Some');
  });

  it('still replaces the panel when a genuinely different selection is made while it is open', async () => {
    const other = document.createElement('p');
    other.textContent = 'A different sentence entirely.';
    document.body.appendChild(other);

    render(<TranslationPopover />);

    setSelection(paragraph.firstChild!, 0, 4);
    endPointerSelection();
    const trigger = await screen.findByRole('button', { name: 'Translate selection' });

    fireEvent.mouseDown(trigger);
    fireEvent.click(trigger);
    await screen.findByText('Some');

    setSelection(other.firstChild!, 2, 11); // "different"
    endPointerSelection();

    expect(await screen.findByRole('button', { name: 'Translate selection' })).toBeTruthy();
    expect(screen.queryByText('Some')).toBeNull();

    other.remove();
  });

  it('keeps a fresh selection highlighted after dragging it elsewhere while a previous panel is open', async () => {
    const other = document.createElement('p');
    other.textContent = 'A different sentence entirely.';
    document.body.appendChild(other);

    render(<TranslationPopover />);

    setSelection(paragraph.firstChild!, 0, 4);
    endPointerSelection();
    await screen.findByRole('button', { name: 'Translate selection' });

    // A real mouse drag-selection starts with a pointerdown on the page, which - on a fine pointer -
    // dismisses the previous panel immediately (see use-selection-floating.ts), before the drag even
    // begins. The rest of the gesture then proceeds exactly as any fresh selection would.
    fireEvent.pointerDown(other);
    setSelection(other.firstChild!, 2, 11); // "different"
    endPointerSelection();

    expect(await screen.findByRole('button', { name: 'Translate selection' })).toBeTruthy();
    expect(screen.queryByText('Some')).toBeNull();
    expect(window.getSelection()?.isCollapsed).toBe(false);
    expect(window.getSelection()?.toString()).toBe('different');

    other.remove();
  });

  it('clears the selection once the panel is closed via its close button', async () => {
    render(<TranslationPopover />);

    setSelection(paragraph.firstChild!, 0, 4);
    endPointerSelection();
    const trigger = await screen.findByRole('button', { name: 'Translate selection' });

    fireEvent.mouseDown(trigger);
    fireEvent.click(trigger);
    await screen.findByText('Some');

    const closeButton = screen.getByRole('button', { name: 'Close' });
    fireEvent.click(closeButton);

    expect(window.getSelection()?.isCollapsed).toBe(true);
    await waitFor(() => expect(screen.queryByText('Some')).toBeNull());
  });

  it('clears the selection when the panel is dismissed by an outside pointerdown', async () => {
    render(<TranslationPopover />);

    setSelection(paragraph.firstChild!, 0, 4);
    endPointerSelection();
    await screen.findByRole('button', { name: 'Translate selection' });

    fireEvent.pointerDown(document.body);

    expect(window.getSelection()?.isCollapsed).toBe(true);
    await waitFor(() => expect(screen.queryByRole('button', { name: 'Translate selection' })).toBeNull());
  });

  it('also clears the selection when the open result panel is dismissed by an outside pointerdown', async () => {
    render(<TranslationPopover />);

    setSelection(paragraph.firstChild!, 0, 4);
    endPointerSelection();
    const trigger = await screen.findByRole('button', { name: 'Translate selection' });

    fireEvent.mouseDown(trigger);
    fireEvent.click(trigger);
    await screen.findByText('Some');

    fireEvent.pointerDown(document.body);

    expect(window.getSelection()?.isCollapsed).toBe(true);
    await waitFor(() => expect(screen.queryByText('Some')).toBeNull());
  });

  it("re-applies the selection range via setBaseAndExtent before clearing it, to dismiss Android's native selection toolbar", async () => {
    render(<TranslationPopover />);

    setSelection(paragraph.firstChild!, 0, 4);
    endPointerSelection();
    const trigger = await screen.findByRole('button', { name: 'Translate selection' });

    const selection = window.getSelection()!;
    const setBaseAndExtentSpy = vi.spyOn(selection, 'setBaseAndExtent');

    const closeButton = await (async () => {
      fireEvent.mouseDown(trigger);
      fireEvent.click(trigger);
      await screen.findByText('Some');
      return screen.getByRole('button', { name: 'Close' });
    })();
    fireEvent.click(closeButton);

    expect(setBaseAndExtentSpy).toHaveBeenCalledWith(paragraph.firstChild, 0, paragraph.firstChild, 0);
    setBaseAndExtentSpy.mockRestore();
  });

  it('does not show a trigger for a selection longer than the max translatable length', async () => {
    const longText = 'word '.repeat(90).trim(); // well over the 400-char cap
    paragraph.textContent = longText;
    render(<TranslationPopover />);

    setSelection(paragraph.firstChild!, 0, longText.length);
    endPointerSelection();

    // No RAF/selection event ever resolves into a trigger here, so there's nothing to await -
    // give the RAF-deferred handler a chance to run before asserting its absence.
    await new Promise((resolve) => requestAnimationFrame(resolve));
    expect(screen.queryByRole('button', { name: 'Translate selection' })).toBeNull();
  });

  it('hides an already-shown trigger when the selection grows past the max translatable length', async () => {
    const longText = 'word '.repeat(90).trim(); // well over the 400-char cap
    paragraph.textContent = longText;
    render(<TranslationPopover />);

    setSelection(paragraph.firstChild!, 0, 4); // "word" - short, well under the cap
    endPointerSelection();
    await screen.findByRole('button', { name: 'Translate selection' });

    setSelection(paragraph.firstChild!, 0, longText.length); // extend to the whole, over-cap text
    endPointerSelection();

    await waitFor(() => expect(screen.queryByRole('button', { name: 'Translate selection' })).toBeNull());
  });

  it('shows the surrounding context alongside the selected text in the result panel', async () => {
    paragraph.textContent = 'one two three four five six seven';
    render(<TranslationPopover />);

    const text = paragraph.firstChild!.textContent!;
    const start = text.indexOf('four');
    setSelection(paragraph.firstChild!, start, start + 'four'.length);
    endPointerSelection();
    const trigger = await screen.findByRole('button', { name: 'Translate selection' });

    fireEvent.mouseDown(trigger);
    fireEvent.click(trigger);
    await screen.findByText('four');

    const contextText = document.querySelector('pre')!.textContent!;
    expect(contextText).toContain('one two three');
    expect(contextText).toContain('five six seven');
  });

  it('shows the trigger button once a keyboard-driven selection settles', async () => {
    render(<TranslationPopover />);

    setSelection(paragraph.firstChild!, 0, 4);
    endKeySelection();

    expect(await screen.findByRole('button', { name: 'Translate selection' })).toBeTruthy();
  });

  it("keeps the later selection when two selections are made before the first one's RAF frame runs", async () => {
    const other = document.createElement('p');
    other.textContent = 'A different sentence entirely.';
    document.body.appendChild(other);

    render(<TranslationPopover />);

    setSelection(paragraph.firstChild!, 0, 4); // "Some"
    endPointerSelection();
    setSelection(other.firstChild!, 2, 11); // "different"
    endPointerSelection();

    const trigger = await screen.findByRole('button', { name: 'Translate selection' });
    fireEvent.mouseDown(trigger);
    fireEvent.click(trigger);

    expect(await screen.findByText('different')).toBeTruthy();
    expect(screen.queryByText('Some')).toBeNull();

    other.remove();
  });
});

describe('TranslationPopover (mobile)', () => {
  let matchMediaSpy: ReturnType<typeof vi.spyOn>;
  let paragraph: HTMLParagraphElement;

  beforeEach(() => {
    matchMediaSpy = vi.spyOn(window, 'matchMedia').mockReturnValue({
      matches: true, // '(pointer: coarse)' matches -> mobile
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    } as unknown as MediaQueryList);

    paragraph = document.createElement('p');
    paragraph.textContent = 'Some selectable text here.';
    document.body.appendChild(paragraph);
  });

  afterEach(() => {
    matchMediaSpy.mockRestore();
    window.getSelection()?.removeAllRanges();
    paragraph.remove();
    cleanup();
  });

  it('shows the trigger button anchored to the selection, not pinned to the bottom of the screen', async () => {
    render(<TranslationPopover />);

    setSelection(paragraph.firstChild!, 0, 4);
    endPointerSelection();

    const trigger = await screen.findByRole('button', { name: 'Translate selection' });
    // A fixed bottom sheet is exactly what this replaces - it must not still render as one, or it's
    // back to being coverable by a mobile browser's own bottom-anchored "search Google for..." bar.
    expect(document.querySelector('[data-slot="translation-sheet"]')).toBeNull();
    expect(trigger.closest('[style*="position: absolute"]')).toBeTruthy();
  });

  it('keeps the selection alive through a trigger tap, same as desktop, and shows the result panel', async () => {
    render(<TranslationPopover />);

    setSelection(paragraph.firstChild!, 0, 4);
    endPointerSelection();
    const trigger = await screen.findByRole('button', { name: 'Translate selection' });

    fireEvent.mouseDown(trigger);
    fireEvent.click(trigger);

    expect(await screen.findByText('Some')).toBeTruthy();
    expect(window.getSelection()?.isCollapsed).toBe(false);
  });

  it('dismisses on an outside tap', async () => {
    render(<TranslationPopover />);

    setSelection(paragraph.firstChild!, 0, 4);
    endPointerSelection();
    await screen.findByRole('button', { name: 'Translate selection' });

    fireEvent.click(document.body);

    await waitFor(() => expect(screen.queryByRole('button', { name: 'Translate selection' })).toBeNull());
  });
});
