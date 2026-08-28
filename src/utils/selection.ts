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

// nodeType/tagName, not instanceof - a node can come from another window (e.g. an iframe), whose
// Element/Text/HTMLBRElement constructors differ from this window's, so instanceof would miss it.
const isElement = (node: Node): node is Element => node.nodeType === Node.ELEMENT_NODE;
const isText = (node: Node): node is Text => node.nodeType === Node.TEXT_NODE;
const isBrElement = (node: Node): boolean => isElement(node) && node.tagName === 'BR';

const closestTextLayer = (node: Node): Element | null => {
  const element = isElement(node) ? node : node.parentElement;
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
  if (isElement(commonAncestorContainer)) return commonAncestorContainer;

  const leaf = commonAncestorContainer.parentElement;
  return leaf?.parentElement ?? leaf;
};

// pdf.js's text layer inserts an empty <br role="presentation"> at every line wrap (confirmed in
// pdfjs-dist's TextLayer#appendText, on hasEOL). Read as a word separator, same as any other node.
const isTextOrBreak = (node: Node): boolean => isText(node) || isBrElement(node);

const createContextWalker = (scope: Element) =>
  document.createTreeWalker(scope, NodeFilter.SHOW_TEXT | NodeFilter.SHOW_ELEMENT, (node) =>
    isTextOrBreak(node) ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_SKIP,
  );

// `edge` is the child sitting right at a Range's element/child-index boundary - descend into it to
// find the nearest text/br inside, falling back to edge itself, or to walking past it, when it holds
// no text/br content of its own.
const seekEdge = (walker: TreeWalker, edge: Node, forward: boolean): Node | null => {
  walker.currentNode = edge;
  const descended = forward ? walker.firstChild() : walker.lastChild();
  if (descended) return descended;
  if (isTextOrBreak(edge)) return edge;
  return forward ? walker.nextNode() : walker.previousNode();
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

  if (side === 'before') {
    const cut = words[words.length - count - 1];
    return text.slice(cut.index + cut.segment.length).trim();
  }

  const cut = words[count];
  return text.slice(0, cut.index).trim();
};

// Walks scope outward from a Range boundary, gathering text/br content one node at a time, stopping
// as soon as there's enough for takeWords to resolve the cut - so a call only ever reads as much of
// scope as CONTEXT_WORDS actually needs, not the whole thing.
const collectWords = (scope: Element, node: Node, offset: number, side: 'before' | 'after'): string => {
  const forward = side === 'after';
  const walker = createContextWalker(scope);
  const step = () => (forward ? walker.nextNode() : walker.previousNode());
  const advanceFrom = (from: Node) => {
    walker.currentNode = from;
    return step();
  };

  let buffer: string;
  let current: Node | null;

  if (isText(node)) {
    buffer = forward ? node.data.slice(offset) : node.data.slice(0, offset);
    current = advanceFrom(node);
  } else {
    const edge = forward ? node.childNodes[offset] : node.childNodes[offset - 1];
    buffer = '';
    current = edge ? seekEdge(walker, edge, forward) : advanceFrom(node);
  }

  while (current && wordLikeSegments(buffer).length <= CONTEXT_WORDS) {
    const chunk = isText(current) ? current.data : ' ';
    buffer = forward ? buffer + chunk : chunk + buffer;
    current = step();
  }

  return buffer;
};

export const getContext = (range: Range): { before: string | null; after: string | null } => {
  try {
    const scope = findExpansionScope(range);
    if (!scope) return { before: null, after: null };

    const before = collectWords(scope, range.startContainer, range.startOffset, 'before');
    const after = collectWords(scope, range.endContainer, range.endOffset, 'after');

    return {
      before: takeWords(before, CONTEXT_WORDS, 'before'),
      after: takeWords(after, CONTEXT_WORDS, 'after'),
    };
  } catch (err) {
    console.error(err);
    return { before: null, after: null };
  }
};
