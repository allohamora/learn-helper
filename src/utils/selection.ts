// Known limitations:
// - findExpansionScope has no upper bound on how broad a resolved scope can be (it can resolve to
//   <body> for a very wide, non-.textLayer selection) - this only risks picking an imprecise boundary
//   in unusual page layouts, not a hang, since the word window itself is still capped.
// - getContext takes a single Range - a Firefox-only discontiguous multi-range selection
//   (ctrl/cmd-click) is only ever resolved for whichever range the caller passes in.
// - The <br> handling below only patches <br> itself, the confirmed pdf.js line-wrap artifact.
//   Adjacent block-level elements (e.g. <p><p>) with no text node between them could plausibly glue
//   words together the same way, but that's unverified here and left unhandled.

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

// pdf.js's text layer inserts an empty <br role="presentation"> at every line wrap (confirmed in
// pdfjs-dist's TextLayer#appendText, on hasEOL). It contributes no characters to textContent or
// Range.toString(), so two words split only by a wrap would otherwise glue together with nothing for
// Intl.Segmenter to split on. Read each <br> as a single space by working against a detached clone,
// so nothing here ever touches the live DOM.
const withBreaksAsSpaces = (scope: Element): Element => {
  const clone = scope.cloneNode(true) as Element;
  clone.querySelectorAll('br').forEach((br) => br.replaceWith(document.createTextNode(' ')));
  return clone;
};

// Range.toString() resolves both text-node and element/child-index boundary points correctly on its
// own, so it's kept as the source of truth for the offset - only <br>s need correcting for, since
// they're absent from Range.toString() the same way they're absent from textContent. cloneContents()
// gives an exact, still-detached count of how many sit before this boundary.
const getOffsetFrom = (scope: Element, node: Node, offset: number) => {
  const preRange = document.createRange();
  preRange.setStart(scope, 0);
  preRange.setEnd(node, offset);

  const breaksBefore = preRange.cloneContents().querySelectorAll('br').length;
  return preRange.toString().length + breaksBefore;
};

const WORD_SEGMENTER = new Intl.Segmenter(undefined, { granularity: 'word' });

const wordLikeSegments = (text: string) => Array.from(WORD_SEGMENTER.segment(text)).filter((s) => s.isWordLike);

// Slices the last/first `count` words out of `text`. The cut point sits at the neighboring
// *excluded* word's edge rather than the counted word's own edge, so punctuation/whitespace between
// the last included word and the next word (e.g. a trailing ".") rides along naturally. Returns null
// if there's no word-like content left on this side.
const takeWords = (text: string, count: number, side: 'before' | 'after'): string | null => {
  const words = wordLikeSegments(text);
  if (words.length === 0) return null;
  if (words.length <= count) return text.trim();

  const cut = side === 'before' ? words[words.length - count - 1] : words[count];
  const index = side === 'before' ? cut.index + cut.segment.length : cut.index;

  return (side === 'before' ? text.slice(index) : text.slice(0, index)).trim();
};

export const getContext = (range: Range): { before: string | null; after: string | null } => {
  try {
    const scope = findExpansionScope(range);
    if (!scope) return { before: null, after: null };

    const text = withBreaksAsSpaces(scope).textContent ?? '';
    const start = getOffsetFrom(scope, range.startContainer, range.startOffset);
    const end = getOffsetFrom(scope, range.endContainer, range.endOffset);

    return {
      before: takeWords(text.slice(0, start), CONTEXT_WORDS, 'before'),
      after: takeWords(text.slice(end), CONTEXT_WORDS, 'after'),
    };
  } catch (err) {
    console.error(err);
    return { before: null, after: null };
  }
};
