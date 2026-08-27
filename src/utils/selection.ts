import { split, SentenceSplitterSyntax } from 'sentence-splitter';

// Known limitations:
// - Adjacent DOM blocks with no whitespace between them (e.g. two <span> "lines" glued together
//   with nothing in between) can get concatenated with no separator, misreading two blocks as one
//   run-on sentence. Only bounded by .textLayer scoping (real PDF pages each get their own layer);
//   not fixable from DOM text alone - the identical shape (two adjacent <span>s, no space)
//   legitimately needs no space when it's just styled sub-runs of one sentence, and needs a space
//   when it's two separate paragraphs, and nothing in the markup tells them apart.
// - The abbreviation check (hasSentenceBreakAt) is tested against the nearest sibling that has real
//   text (see nextMeaningfulSibling), skipping only empty separators. If a real but irrelevant
//   fragment sits between the two halves of a split abbreviation (e.g. "Mr." / decoy / "Smith..."),
//   expansion can still truncate at the decoy. Not fixed because pdf.js only ever inserts empty
//   <br> separators between wrapped lines, never unrelated text, so this shape doesn't occur in
//   real PDF text layers.
// - findExpansionScope has no upper bound on how broad a resolved scope can be (it can resolve to
//   <body> for a very wide, non-.textLayer selection). Sibling expansion is still capped by
//   MAX_SIBLING_EXPAND either way, so this can't hang - it only risks picking an imprecise boundary
//   in unusual page layouts. A guard against this was tried and reverted: it broke the common case
//   of a single paragraph sitting directly under <body>.
// - Abbreviation handling is only as good as the sentence-splitter package's own abbreviation
//   dictionary; domain-specific abbreviations it doesn't recognize (e.g. "Fig.", "approx.") won't
//   get merged back into their sentence.
// - MAX_SIBLING_EXPAND is a hard cap; an unusually dense text layer (e.g. one span per word) that
//   needs more hops than that falls back to the raw selected text instead of the full sentence.
// - Only Latin-script casing/punctuation is recognized (STARTS_LOWERCASE, ENDS_SENTENCE); non-Latin
//   scripts (e.g. CJK) aren't supported.

const TEXT_LAYER_SELECTOR = '.textLayer';

const closestTextLayer = (node: Node): Element | null => {
  const element = node.nodeType === Node.ELEMENT_NODE ? (node as Element) : node.parentElement;
  return element?.closest(TEXT_LAYER_SELECTOR) ?? null;
};

const findExpansionScope = (range: Range): Element | null => {
  const startLayer = closestTextLayer(range.startContainer);
  const endLayer = closestTextLayer(range.endContainer);
  if (startLayer || endLayer) return startLayer === endLayer ? startLayer : null;

  const commonAncestor = range.commonAncestorContainer;
  if (commonAncestor.nodeType === Node.ELEMENT_NODE) return commonAncestor as Element;

  const leaf = commonAncestor.parentElement;
  return leaf?.parentElement ?? leaf;
};

const STARTS_LOWERCASE = /^\s*\p{Ll}/u;
const ENDS_SENTENCE = /[.!?]\s*$/;
const MAX_SIBLING_EXPAND = 30;

const getSentences = (text: string) => {
  return split(text)
    .filter((node) => node.type === SentenceSplitterSyntax.Sentence)
    .map((node) => ({ start: node.range[0], end: node.range[1] }));
};

const joinWithSpace = (a: string, b: string): string => {
  if (!a) return b;
  if (!b) return a;
  return /\s$/.test(a) || /^\s/.test(b) ? `${a}${b}` : `${a} ${b}`;
};

// Own-text regexes can't tell an abbreviation ("Mr.") from a real sentence end. This asks the real
// sentence splitter instead: given what follows, does `before` actually end a sentence there?
const hasSentenceBreakAt = (before: string, after: string): boolean => {
  const [firstSentence] = getSentences(joinWithSpace(before, after));
  return !!firstSentence && firstSentence.end <= before.length;
};

// Walks past empty separators (e.g. pdf.js's bare <br> between wrapped lines) to the next sibling
// that actually has text, capped so a run of empty nodes can't turn this into an unbounded search.
// A sibling with real but unrelated text (not just an empty separator) still counts as "meaningful"
// and stops the walk here - only pdf.js's own layout nodes are expected to carry no text at all.
const nextMeaningfulSibling = (node: Node, direction: 'previousSibling' | 'nextSibling'): Node | null => {
  let sibling = node[direction];

  for (let hops = 0; sibling && hops < MAX_SIBLING_EXPAND; hops++) {
    if ((sibling.textContent ?? '').trim()) return sibling;
    sibling = sibling[direction];
  }

  return null;
};

// `before`'s own text ends with real punctuation, but is that punctuation actually sentence-final
// (e.g. "end.") or just an abbreviation ("Mr.") that reads on into `after`? Real terminal punctuation
// with nothing more to disambiguate is trusted as-is; anything else is confirmed against the real
// sentence splitter.
const isRealSentenceEnd = (before: string, after: string): boolean =>
  ENDS_SENTENCE.test(before) ? hasSentenceBreakAt(before, after) : !STARTS_LOWERCASE.test(after);

// Mirror of isRealSentenceEnd: `after`'s own text looks like a fresh sentence start, but is
// `before` actually finished, or is `after` really the abbreviation-continuation of it ("Smith"
// after "Mr.")? A lowercase-starting `after` is always trusted as a continuation outright - unlike
// trailing punctuation, that signal is never produced by an abbreviation.
const isRealSentenceStart = (before: string, after: string): boolean =>
  STARTS_LOWERCASE.test(after) ? false : !ENDS_SENTENCE.test(before) || hasSentenceBreakAt(before, after);

const fontSizeOf = (node: Node): number => {
  const element = node.nodeType === Node.ELEMENT_NODE ? (node as Element) : node.parentElement;
  return element ? parseFloat(getComputedStyle(element).fontSize) : NaN;
};

// A heading is almost always rendered in a visually distinct font size from body text, even when it
// has no punctuation of its own to signal that. Real pdf.js text-layer spans carry inline styles
// matching the PDF's actual rendered fonts, so a large enough font-size gap is treated as a hard
// "different block" signal that overrides the text-only checks above - even an abbreviation-looking
// merge shouldn't cross it. The ratio (not a flat px difference) tolerates the tiny floating-point
// font-size variance pdf.js sometimes introduces between spans of the same line.
const STYLE_MISMATCH_RATIO = 1.2;

const hasStyleBreakBetween = (a: Node, b: Node): boolean => {
  const sizeA = fontSizeOf(a);
  const sizeB = fontSizeOf(b);
  if (!sizeA || !sizeB) return false;

  return Math.max(sizeA, sizeB) / Math.min(sizeA, sizeB) >= STYLE_MISMATCH_RATIO;
};

const expandToSentenceStart = (node: Node): Node | null => {
  let current = node;

  for (let steps = 0; steps < MAX_SIBLING_EXPAND; steps++) {
    const prev = nextMeaningfulSibling(current, 'previousSibling');
    if (!prev) return current;

    const ownText = (current.textContent ?? '').trim();
    const prevText = (prev.textContent ?? '').trim();
    if (ownText !== '' && (isRealSentenceStart(prevText, ownText) || hasStyleBreakBetween(prev, current))) {
      return current;
    }

    current = prev;
  }

  return null;
};

const expandToSentenceEnd = (node: Node): Node | null => {
  let current = node;

  for (let steps = 0; steps < MAX_SIBLING_EXPAND; steps++) {
    const next = nextMeaningfulSibling(current, 'nextSibling');
    if (!next) return current;

    const ownText = (current.textContent ?? '').trim();
    const nextText = (next.textContent ?? '').trim();
    if (ownText !== '' && (isRealSentenceEnd(ownText, nextText) || hasStyleBreakBetween(current, next))) {
      return current;
    }

    current = next;
  }

  return null;
};

const findTouchedChild = (scope: Element, node: Node, offset: number): Node | null => {
  if (node === scope) return scope.childNodes[Math.min(offset, scope.childNodes.length - 1)] ?? null;

  let current = node;
  while (current.parentNode && current.parentNode !== scope) {
    current = current.parentNode;
  }

  return current.parentNode === scope ? current : null;
};

const findSentenceStart = (scope: Element, range: Range): Node | null => {
  const touched = findTouchedChild(scope, range.startContainer, range.startOffset);
  return touched && expandToSentenceStart(touched);
};

const findSentenceEnd = (scope: Element, range: Range): Node | null => {
  const touched = findTouchedChild(scope, range.endContainer, range.endOffset);
  return touched && expandToSentenceEnd(touched);
};

const getOffsetFrom = (boundaryNode: Node, node: Node, offset: number) => {
  const preRange = document.createRange();
  preRange.setStartBefore(boundaryNode);
  preRange.setEnd(node, offset);
  return preRange.toString().length;
};

const extractOverlappingSentences = (start: Node, end: Node, range: Range): string => {
  const boundedRange = document.createRange();
  boundedRange.setStartBefore(start);
  boundedRange.setEndAfter(end);

  const text = boundedRange.toString();
  if (!text) return '';

  const selectionStart = getOffsetFrom(start, range.startContainer, range.startOffset);
  const selectionEnd = getOffsetFrom(start, range.endContainer, range.endOffset);

  const overlapping = getSentences(text).filter(
    (sentence) => sentence.end > selectionStart && sentence.start < selectionEnd,
  );
  if (overlapping.length === 0) return '';

  const contextStart = Math.min(...overlapping.map((sentence) => sentence.start));
  const contextEnd = Math.max(...overlapping.map((sentence) => sentence.end));
  return text.slice(contextStart, contextEnd).trim();
};

const resolveSentenceContext = (range: Range): string => {
  const scope = findExpansionScope(range);
  if (!scope) return '';

  const start = findSentenceStart(scope, range);
  const end = findSentenceEnd(scope, range);
  if (!start || !end) return '';

  return extractOverlappingSentences(start, end, range);
};

export const getContext = (selection: Selection): string => {
  if (selection.rangeCount === 0) return '';

  const range = selection.getRangeAt(0);
  const selectedText = selection.toString().trim();

  try {
    return resolveSentenceContext(range) || selectedText;
  } catch (err) {
    console.error(err);
    return selectedText;
  }
};
