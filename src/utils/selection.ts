import { split, SentenceSplitterSyntax } from 'sentence-splitter';

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

// Peeks past empty separators (e.g. pdf.js's bare <br> between wrapped lines) to find the nearest
// sibling with real text, without consuming them - the caller still walks one sibling at a time.
const nearestSiblingText = (node: Node, direction: 'previousSibling' | 'nextSibling'): string => {
  let sibling = node[direction];

  while (sibling) {
    const text = (sibling.textContent ?? '').trim();
    if (text) return text;

    sibling = sibling[direction];
  }

  return '';
};

const expandToSentenceStart = (node: Node): Node | null => {
  let current = node;

  for (let steps = 0; steps < MAX_SIBLING_EXPAND; steps++) {
    const ownText = (current.textContent ?? '').trim();
    const looksLikeStart = ownText !== '' && !STARTS_LOWERCASE.test(ownText);

    const prev = current.previousSibling;
    if (!prev) return current;

    if (looksLikeStart) {
      const prevText = nearestSiblingText(current, 'previousSibling');
      const isAbbreviation = prevText !== '' && ENDS_SENTENCE.test(prevText) && !hasSentenceBreakAt(prevText, ownText);
      if (!isAbbreviation) return current;
    }

    current = prev;
  }

  return null;
};

const expandToSentenceEnd = (node: Node): Node | null => {
  let current = node;

  for (let steps = 0; steps < MAX_SIBLING_EXPAND; steps++) {
    const ownText = (current.textContent ?? '').trim();
    const finished = ownText !== '' && ENDS_SENTENCE.test(ownText);

    const next = current.nextSibling;
    if (!next) return current;

    if (finished) {
      const nextText = nearestSiblingText(current, 'nextSibling');
      const isAbbreviation = nextText !== '' && !hasSentenceBreakAt(ownText, nextText);
      if (!isAbbreviation) return current;
    } else if (ownText !== '') {
      const nextText = (next.textContent ?? '').trim();
      if (nextText && !STARTS_LOWERCASE.test(nextText)) return current;
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

export const getContext = (selection: Selection): string => {
  if (selection.rangeCount === 0) return '';

  const range = selection.getRangeAt(0);
  const getSelectedText = () => selection.toString().trim();

  try {
    const scope = findExpansionScope(range);
    if (!scope) return getSelectedText();

    const start = findSentenceStart(scope, range);
    const end = findSentenceEnd(scope, range);
    if (!start || !end) return getSelectedText();

    return extractOverlappingSentences(start, end, range) || getSelectedText();
  } catch (err) {
    console.error(err);
    return getSelectedText();
  }
};
