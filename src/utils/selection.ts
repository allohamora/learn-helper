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
const MAX_SIBLING_EXPAND = 20;

const expandToSentenceStart = (node: Node): Node => {
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

const expandToSentenceEnd = (node: Node): Node => {
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

const getSentences = (text: string) => {
  return split(text)
    .filter((node) => node.type === SentenceSplitterSyntax.Sentence)
    .map((node) => ({ start: node.range[0], end: node.range[1] }));
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
