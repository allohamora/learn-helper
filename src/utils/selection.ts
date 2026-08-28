// Known limitations:
// - Word counting splits on whitespace, so scripts with no spaces between words (e.g. CJK) don't get
//   a meaningful word count - a whole run of such characters counts as a single "word."
// - findExpansionScope has no upper bound on how broad a resolved scope can be (it can resolve to
//   <body> for a very wide, non-.textLayer selection) - this only risks picking an imprecise boundary
//   in unusual page layouts, not a hang, since the word window itself is still capped.
// - getBefore/getAfter take a single Range - a Firefox-only discontiguous multi-range selection
//   (ctrl/cmd-click) is only ever resolved for whichever range the caller passes in.

const TEXT_LAYER_SELECTOR = '.textLayer';

// Tried against a sample paragraph, selecting a word mid-sentence:
// - 15: reaches back across a full sentence boundary (e.g. "...last audit. The manager explained
//   that the increase covered a") - enough to resolve a reference to the prior sentence.
// - 20: same prior sentence, just a little more of it - marginal gain over 15.
// - 25: starts pulling in a second, more distant sentence - more text, but lower relevance per word.
// 15 clears the bar (reaching one sentence back) without the extra, less-relevant text 25 adds.
const CONTEXT_WORDS = 15;

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

const getOffsetFrom = (boundary: Element, node: Node, offset: number) => {
  const preRange = document.createRange();
  preRange.setStart(boundary, 0);
  preRange.setEnd(node, offset);
  return preRange.toString().length;
};

const WORD = /\S+/g;
const HAS_WORD_CONTENT = /[\p{L}\p{N}]/u;

// Slices the last/first `count` whitespace-separated tokens out of `text`, trimmed. Returns null if
// nothing is left, or what's left has no real letter/number content (e.g. a lone trailing comma isn't
// useful context).
const takeWords = (text: string, count: number, side: 'before' | 'after'): string | null => {
  const matches = Array.from(text.matchAll(WORD));
  if (matches.length === 0) return null;

  const slice =
    side === 'before'
      ? text.slice(matches[Math.max(0, matches.length - count)].index)
      : text.slice(
          0,
          matches[Math.min(count, matches.length) - 1].index + matches[Math.min(count, matches.length) - 1][0].length,
        );

  const trimmed = slice.trim();
  return HAS_WORD_CONTENT.test(trimmed) ? trimmed : null;
};

export const getBefore = (range: Range): string | null => {
  try {
    const scope = findExpansionScope(range);
    if (!scope) return null;

    const text = scope.textContent ?? '';
    const start = getOffsetFrom(scope, range.startContainer, range.startOffset);
    return takeWords(text.slice(0, start), CONTEXT_WORDS, 'before');
  } catch (err) {
    console.error(err);
    return null;
  }
};

export const getAfter = (range: Range): string | null => {
  try {
    const scope = findExpansionScope(range);
    if (!scope) return null;

    const text = scope.textContent ?? '';
    const end = getOffsetFrom(scope, range.endContainer, range.endOffset);
    return takeWords(text.slice(end), CONTEXT_WORDS, 'after');
  } catch (err) {
    console.error(err);
    return null;
  }
};
