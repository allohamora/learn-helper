import { split, SentenceSplitterSyntax } from 'sentence-splitter';

// Known limitations:
// - Adjacent DOM blocks with no whitespace between them (e.g. two <span> "lines" glued together
//   with nothing in between) can get concatenated with no separator, misreading two blocks as one
//   run-on sentence. Only bounded by .textLayer scoping (real PDF pages each get their own layer);
//   not fixable from DOM text alone - the identical shape (two adjacent <span>s, no space)
//   legitimately needs no space when it's just styled sub-runs of one sentence, and needs a space
//   when it's two separate paragraphs, and nothing in the markup tells them apart.
// - The font-size guard (hasStyleBreak) only catches a structural break when it's rendered with a
//   distinctly different font size (>= 20% apart, STYLE_MISMATCH_RATIO). A heading styled only
//   through font-weight/color at the same font-size isn't caught, and the expansion window can
//   include it; the final sentence split then only rescues this if punctuation/casing happens to
//   separate it anyway. The 20% threshold is a guess, not validated against real PDF documents.
// - findExpansionScope has no upper bound on how broad a resolved scope can be (it can resolve to
//   <body> for a very wide, non-.textLayer selection). Segment collection is still capped by
//   MAX_TEXT_SEGMENTS either way, so this can't hang - it only risks picking an imprecise boundary
//   in unusual page layouts.
// - Abbreviation handling is only as good as the sentence-splitter package's own abbreviation
//   dictionary; domain-specific abbreviations it doesn't recognize (e.g. "Fig.", "approx.") won't
//   get merged back into their sentence.
// - MAX_TEXT_SEGMENTS is a hard cap on how many text-bearing nodes a scope can contribute; an
//   unusually dense text layer (e.g. one span per word) that needs more than that falls back to the
//   raw selected text instead of the full sentence.
// - Only Latin-script casing/punctuation is recognized by the underlying splitter; non-Latin scripts
//   (e.g. CJK) aren't supported.
// - Only the selection's first range is used (selection.getRangeAt(0)); a Firefox-only discontiguous
//   multi-range selection (ctrl/cmd-click) is read as just that first range.
// - A segment with no trailing punctuation at all is always treated as a hard boundary when the next
//   segment starts uppercase (see isSentenceBoundary) - this is what lets a heading or label without
//   punctuation stop expansion. It can misfire the other way on a genuine mid-sentence line wrap that
//   happens to break right before a capitalized proper noun (e.g. "...members of the United" /
//   "Nations Security Council..." split across two lines), cutting the sentence short. Same class of
//   problem as the "glued blocks" case above - nothing in the DOM text tells a wrapped proper noun
//   apart from a real fresh block.

const TEXT_LAYER_SELECTOR = '.textLayer';
const MAX_TEXT_SEGMENTS = 500;
const STYLE_MISMATCH_RATIO = 1.2;

const closestTextLayer = (node: Node): Element | null => {
  const element = node.nodeType === Node.ELEMENT_NODE ? (node as Element) : node.parentElement;
  return element?.closest(TEXT_LAYER_SELECTOR) ?? null;
};

// .textLayer is the one reliable signal for a real PDF page boundary (react-pdf and pdf.js both
// render one per page, including when several pages are mounted as virtualized siblings at once) -
// nothing in generic DOM structure can stand in for it, so a selection spanning two different layers
// is rejected outright rather than risk merging unrelated pages. Outside of any .textLayer, the
// scope is just the selection's nearest common element ancestor, bumped up one level when that
// ancestor is a single text node so there's always at least one sibling to expand into.
const findExpansionScope = (range: Range): Element | null => {
  const startLayer = closestTextLayer(range.startContainer);
  const endLayer = closestTextLayer(range.endContainer);
  if (startLayer || endLayer) return startLayer === endLayer ? startLayer : null;

  const { commonAncestorContainer } = range;
  if (commonAncestorContainer.nodeType === Node.ELEMENT_NODE) return commonAncestorContainer as Element;

  const leaf = commonAncestorContainer.parentElement;
  return leaf?.parentElement ?? leaf;
};

const getSentences = (text: string) => {
  return split(text)
    .filter((node) => node.type === SentenceSplitterSyntax.Sentence)
    .map((node) => ({ start: node.range[0], end: node.range[1] }));
};

const fontSizeOf = (node: Node): number => {
  const element = node.nodeType === Node.ELEMENT_NODE ? (node as Element) : node.parentElement;
  return element ? parseFloat(getComputedStyle(element).fontSize) : NaN;
};

// A heading is almost always rendered in a visually distinct font size from body text, even with no
// punctuation of its own to signal that. This is a hard "different block" signal that overrides
// everything else - even a segment that would otherwise read as a sentence continuation shouldn't
// cross it. The ratio (not a flat px difference) tolerates the tiny floating-point font-size variance
// pdf.js sometimes introduces between spans of the same line.
const hasStyleBreak = (a: number, b: number): boolean => {
  if (!a || !b) return false;
  return Math.max(a, b) / Math.min(a, b) >= STYLE_MISMATCH_RATIO;
};

const STARTS_LOWERCASE = /^\p{Ll}/u;
const ENDS_SENTENCE = /[.!?…]$/;

// Two adjacent segments are almost always separate DOM nodes with no real whitespace between them
// (see the "glued blocks" limitation above) - a plain punctuation regex can't tell "makes." glued to
// "Appendix" apart from a real mid-word join, and the real splitter needs a space after a period to
// treat it as a break at all. Inserting one only for this check (never in the returned text) lets the
// splitter judge it correctly either way, without misreading genuine sub-word joins like "some" +
// "thing" as separate sentences. Segment text is always pre-trimmed (see collectSegments), so both
// sides are guaranteed non-empty with no whitespace of their own to collide with the inserted space.
const joinWithSpace = (a: string, b: string): string => `${a} ${b}`;

// A lowercase start after `earlier` is always trusted as a continuation outright, since that signal
// is never produced by an abbreviation. Otherwise, real terminal punctuation with nothing more to
// disambiguate would need the splitter to weigh in anyway, and its absence is itself decisive (a
// heading or label with no trailing punctuation at all reads as a fresh block, not a continuation).
const isSentenceBoundary = (earlier: string, later: string): boolean => {
  if (STARTS_LOWERCASE.test(later)) return false;
  if (!ENDS_SENTENCE.test(earlier)) return true;

  const [firstSentence] = getSentences(joinWithSpace(earlier, later));
  return !!firstSentence && firstSentence.end <= earlier.length;
};

type Segment = { start: number; end: number; node: Node; text: string; fontSize?: number };

// fontSize is read lazily (and cached here on first read) because getComputedStyle forces a style
// recalculation - collectSegments can gather up to MAX_TEXT_SEGMENTS segments, but expandIndex only
// ever needs the font size of the handful actually walked while expanding outward from the selection.
const getFontSize = (segment: Segment): number => {
  if (segment.fontSize === undefined) segment.fontSize = fontSizeOf(segment.node);
  return segment.fontSize;
};

// Walks every text node under scope once, in document order, regardless of how deeply or unevenly
// they're nested - unlike a sibling walk, this needs no assumptions about the surrounding markup
// shape, so the same pass works for pdf.js/react-pdf's flat wrapped-line spans and for ordinary
// nested HTML alike. Whitespace-only text nodes (e.g. pdf.js's bare <br> separators produce none,
// but a real text gap between block siblings does) are skipped as segments but still counted towards
// the running offset, so segment positions stay aligned with scope's own concatenated text.
// `truncated` tells the caller the cap actually cut off real text rather than the scope just running
// out - resolveSentenceContext uses it to tell "expansion hit the true end of scope" (a real boundary)
// apart from "expansion hit the cap" (an arbitrary one it shouldn't trust).
const collectSegments = (scope: Element): { segments: Segment[]; truncated: boolean } => {
  const walker = document.createTreeWalker(scope, NodeFilter.SHOW_TEXT);
  const segments: Segment[] = [];

  let cursor = 0;
  let node: Node | null;
  while ((node = walker.nextNode())) {
    const text = node.textContent ?? '';

    const trimmed = text.trim();
    if (trimmed) {
      if (segments.length >= MAX_TEXT_SEGMENTS) return { segments, truncated: true };
      segments.push({ start: cursor, end: cursor + text.length, node, text: trimmed });
    }

    cursor += text.length;
  }

  return { segments, truncated: false };
};

// Finds every segment the selection overlaps, mirroring the overlap test used later to pick
// sentences out of the resolved window - the same "does this span touch that span" rule at both the
// segment and the sentence level.
const findTouchedRange = (segments: Segment[], from: number, to: number): [number, number] | null => {
  const touched = segments.reduce<number[]>((indices, segment, index) => {
    if (segment.end > from && segment.start < to) indices.push(index);
    return indices;
  }, []);

  return touched.length ? [touched[0], touched[touched.length - 1]] : null;
};

const expandIndex = (segments: Segment[], index: number, step: -1 | 1): number => {
  let current = index;

  while (segments[current + step]) {
    const next = segments[current + step];
    const [earlier, later] = step === -1 ? [next, segments[current]] : [segments[current], next];
    if (hasStyleBreak(getFontSize(earlier), getFontSize(later)) || isSentenceBoundary(earlier.text, later.text)) break;
    current += step;
  }

  return current;
};

const getOffsetFrom = (boundary: Element, node: Node, offset: number) => {
  const preRange = document.createRange();
  preRange.setStart(boundary, 0);
  preRange.setEnd(node, offset);
  return preRange.toString().length;
};

const resolveSentenceContext = (range: Range): string => {
  const scope = findExpansionScope(range);
  if (!scope) return '';

  const { segments, truncated } = collectSegments(scope);
  if (segments.length === 0) return '';

  const selectionStart = getOffsetFrom(scope, range.startContainer, range.startOffset);
  const selectionEnd = getOffsetFrom(scope, range.endContainer, range.endOffset);

  const touched = findTouchedRange(segments, selectionStart, selectionEnd);
  if (!touched) return '';

  const startIndex = expandIndex(segments, touched[0], -1);
  const endIndex = expandIndex(segments, touched[1], 1);
  // Expansion ran off the end of what we collected, not off a real boundary - the true continuation
  // past the cap is unknown, so don't return a sentence that might be silently cut short.
  if (truncated && endIndex === segments.length - 1) return '';

  const windowStart = segments[startIndex].start;
  const windowEnd = segments[endIndex].end;
  const windowText = (scope.textContent ?? '').slice(windowStart, windowEnd);
  if (!windowText) return '';

  const sentences = getSentences(windowText).filter(
    (sentence) => sentence.end > selectionStart - windowStart && sentence.start < selectionEnd - windowStart,
  );
  if (sentences.length === 0) return '';

  const contextStart = Math.min(...sentences.map((sentence) => sentence.start));
  const contextEnd = Math.max(...sentences.map((sentence) => sentence.end));
  return windowText.slice(contextStart, contextEnd).trim();
};

export const getContext = (selection: Selection): string => {
  if (selection.rangeCount === 0) return '';

  const range = selection.getRangeAt(0);
  if (range.collapsed) return '';

  const selectedText = selection.toString().trim();

  try {
    return resolveSentenceContext(range) || selectedText;
  } catch (err) {
    console.error(err);
    return selectedText;
  }
};
