// A selection's context starts from only the DOM nodes it actually touches, then cautiously grows
// into neighboring siblings when there's a real signal the sentence continues there - never the
// whole shared container. Text layouts like a PDF text layer put every line of the page as flat
// sibling <span>s with no per-paragraph nesting, so blindly using the "nearest common ancestor"'s
// full text can pull in every unrelated line, while never looking past the touched nodes at all
// truncates any sentence that happens to wrap across more than one line.
const resolveContainer = (range: Range): Element | null => {
  const node = range.commonAncestorContainer;
  if (node.nodeType === Node.ELEMENT_NODE) return node as Element;

  // A selection entirely within one text node has that node as its own commonAncestorContainer,
  // whose immediate parent is often a single-child leaf (e.g. one line of a PDF text layer) with no
  // siblings of its own to expand into. Climbing one more level exposes the real sibling lines/tags.
  const leaf = node.parentElement;
  return leaf?.parentElement ?? leaf;
};

// Finds the direct child of `container` that (node, offset) falls under - i.e. the specific
// sibling actually touched by that boundary point, no matter how deeply `node` is nested inside it.
const getTouchedChild = (container: Element, node: Node, offset: number): Node | null => {
  if (node === container) return container.childNodes[Math.min(offset, container.childNodes.length - 1)] ?? null;

  let current = node;
  while (current.parentNode && current.parentNode !== container) {
    current = current.parentNode;
  }

  return current.parentNode === container ? current : null;
};

const getOffsetFrom = (boundaryNode: Node, node: Node, offset: number) => {
  const preRange = document.createRange();
  preRange.setStartBefore(boundaryNode);
  preRange.setEnd(node, offset);
  return preRange.toString().length;
};

const STARTS_LOWERCASE = /^\s*\p{Ll}/u;
const ENDS_SENTENCE = /[.!?]\s*$/;
const MAX_SIBLING_EXPAND = 20;

// Walks backward through preceding siblings while the current leftmost node's own text starts with
// a lowercase letter - a reliable signal (in ordinary prose) that it continues a sentence begun
// earlier, e.g. a PDF text-layer line that got wrapped mid-sentence. A paragraph's real first line
// is always capitalized, so this chain naturally stops there and never reaches an unrelated
// preceding heading/title, even though headings often lack trailing punctuation of their own.
// Content-less siblings (e.g. pdf.js inserts a bare <br> after every line) are skipped over rather
// than treated as a stop signal, since they carry no text to judge either way.
const expandBackward = (node: Node): Node => {
  let current = node;

  for (let steps = 0; steps < MAX_SIBLING_EXPAND; steps++) {
    const ownText = current.textContent ?? '';
    if (ownText.trim() && !STARTS_LOWERCASE.test(ownText)) break;

    const prev = current.previousSibling;
    if (!prev) break;

    current = prev;
  }

  return current;
};

// Mirrors expandBackward: walks forward while the current rightmost node's own text doesn't yet end
// a sentence AND the next sibling looks like a continuation (starts lowercase) rather than a fresh,
// capitalized start - so a heading/title lacking trailing punctuation never gets merged with
// whatever unrelated content happens to follow it. Content-less siblings are skipped transparently,
// same as expandBackward.
const expandForward = (node: Node): Node => {
  let current = node;

  for (let steps = 0; steps < MAX_SIBLING_EXPAND; steps++) {
    const ownText = (current.textContent ?? '').trim();
    if (ownText && ENDS_SENTENCE.test(ownText)) break;

    const next = current.nextSibling;
    if (!next) break;

    const nextText = (next.textContent ?? '').trim();
    if (nextText && !STARTS_LOWERCASE.test(nextText)) break;

    current = next;
  }

  return current;
};

const getSentences = (text: string, locale: string) => {
  const segmenter = new Intl.Segmenter(locale, { granularity: 'sentence' });

  return Array.from(segmenter.segment(text), ({ segment, index }) => ({
    text: segment,
    start: index,
    end: index + segment.length,
  }));
};

export const getContext = (selection: Selection, locale = navigator.language): string => {
  const fallback = () => selection.toString().trim();
  if (selection.rangeCount === 0) return '';
  if (typeof Intl.Segmenter !== 'function') return fallback();

  const range = selection.getRangeAt(0);
  const container = resolveContainer(range);
  if (!container) return fallback();

  const firstTouched = getTouchedChild(container, range.startContainer, range.startOffset);
  const lastTouched = getTouchedChild(container, range.endContainer, range.endOffset);
  if (!firstTouched || !lastTouched) return fallback();

  const expandedFirst = expandBackward(firstTouched);
  const expandedLast = expandForward(lastTouched);

  const boundedRange = document.createRange();
  boundedRange.setStartBefore(expandedFirst);
  boundedRange.setEndAfter(expandedLast);

  const text = boundedRange.toString();
  if (!text) return fallback();

  const startOffset = getOffsetFrom(expandedFirst, range.startContainer, range.startOffset);
  const endOffset = getOffsetFrom(expandedFirst, range.endContainer, range.endOffset);

  const sentences = getSentences(text, locale).filter(
    (sentence) => sentence.end > startOffset && sentence.start < endOffset,
  );

  return (
    sentences
      .map((sentence) => sentence.text)
      .join('')
      .trim() || fallback()
  );
};
