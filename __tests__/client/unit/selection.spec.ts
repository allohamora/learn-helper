import { describe, expect, it } from 'vitest';
import { getContext } from '@/utils/selection';

const selectRange = (setup: (range: Range) => void) => {
  const range = document.createRange();
  setup(range);

  const selection = window.getSelection()!;
  selection.removeAllRanges();
  selection.addRange(range);

  return selection;
};

describe('getContext', () => {
  it('returns just the enclosing sentence when the selection is a single word inside it', () => {
    const p = document.createElement('p');
    p.textContent = 'hello my girlfriend!';
    document.body.appendChild(p);

    const textNode = p.firstChild!;
    // selects "hello"
    const selection = selectRange((range) => {
      range.setStart(textNode, 0);
      range.setEnd(textNode, 5);
    });

    expect(getContext(selection)).toBe('hello my girlfriend!');

    p.remove();
  });

  it('returns only the enclosing sentence, not neighboring ones, when the selection stays inside it', () => {
    const p = document.createElement('p');
    p.textContent = 'First sentence here. Second sentence here. Third sentence here.';
    document.body.appendChild(p);

    const textNode = p.firstChild!;
    const selection = selectRange((range) => {
      range.setStart(textNode, 22);
      range.setEnd(textNode, 28);
    });

    expect(getContext(selection)).toBe('Second sentence here.');

    p.remove();
  });

  it('joins both sentences when the selection spans a sentence boundary', () => {
    const p = document.createElement('p');
    p.textContent = 'I found something. dude we gonna be rich';
    document.body.appendChild(p);

    const textNode = p.firstChild!;
    const text = textNode.textContent!;
    // selects "something. dude"
    const start = text.indexOf('something');
    const end = text.indexOf('dude') + 'dude'.length;
    const selection = selectRange((range) => {
      range.setStart(textNode, start);
      range.setEnd(textNode, end);
    });

    expect(getContext(selection)).toBe('I found something. dude we gonna be rich');

    p.remove();
  });

  it('joins all overlapping sentences when the selection spans more than two', () => {
    const p = document.createElement('p');
    p.textContent = 'Sentence one here. Sentence two here. Sentence three here. Sentence four here.';
    document.body.appendChild(p);

    const textNode = p.firstChild!;
    const text = textNode.textContent!;
    // selects from inside "one" through inside "three"
    const start = text.indexOf('one');
    const end = text.indexOf('three') + 'three'.length;
    const selection = selectRange((range) => {
      range.setStart(textNode, start);
      range.setEnd(textNode, end);
    });

    expect(getContext(selection)).toBe('Sentence one here. Sentence two here. Sentence three here.');

    p.remove();
  });

  it('does not include a sentence the selection only touches at its exact boundary', () => {
    const p = document.createElement('p');
    p.textContent = 'Hello. World.';
    document.body.appendChild(p);

    const textNode = p.firstChild!;
    // selects exactly "Hello." (0..6), stopping right before the space before "World."
    const selection = selectRange((range) => {
      range.setStart(textNode, 0);
      range.setEnd(textNode, 6);
    });

    expect(getContext(selection)).toBe('Hello.');

    p.remove();
  });

  it('flattens text split across arbitrarily nested and sibling tags, when all are touched', () => {
    // mirrors a PDF text-layer shape: many spans, some nested, forming one flowing sentence.
    const container = document.createElement('div');
    container.innerHTML =
      '<span>I found </span><span><b>some<i>thing</i></b></span><span>. dude we gonna </span><span>be rich</span>';
    document.body.appendChild(container);

    const startNode = container.firstElementChild!.firstChild!; // "I found "
    const endNode = container.lastElementChild!.firstChild!; // "be rich"
    const selection = selectRange((range) => {
      range.setStart(startNode, 0);
      range.setEnd(endNode, 2); // "be"
    });

    expect(getContext(selection)).toBe('I found something. dude we gonna be rich');

    container.remove();
  });

  it('extends past an inline wrapper to complete the sentence, but stops at a real sentence boundary', () => {
    const p = document.createElement('p');
    p.innerHTML = 'Before text. <em>Emphasized word</em> after text.';
    document.body.appendChild(p);

    const em = p.querySelector('em')!;
    const textNode = em.firstChild!;
    // selects "Emphasized" only - "Before text." is a finished, separate sentence and must not leak
    // in, but "after text." completes the same sentence <em> is part of and should be included.
    const selection = selectRange((range) => {
      range.setStart(textNode, 0);
      range.setEnd(textNode, 10);
    });

    expect(getContext(selection)).toBe('Emphasized word after text.');

    p.remove();
  });

  it('reconstructs a sentence that wraps across several unselected lines, without leaking into a preceding heading', () => {
    // mirrors the reported bug and pdf.js's real text-layer shape: it inserts a bare
    // <br role="presentation"> after every line (see pdf.js TextLayer#appendText, hasEOL), so a
    // sentence spanning multiple lines must be recovered across those <br> siblings too, while a
    // preceding heading with no trailing punctuation of its own must still not be pulled in.
    const container = document.createElement('div');
    const heading = document.createElement('span');
    heading.textContent = 'Appendix Three Glossary Index';
    const line1 = document.createElement('span');
    line1.textContent = 'This guide exists to help you learn faster. If a chapter feels dense, ';
    const line2 = document.createElement('span');
    line2.textContent = 'there are usually examples nearby ';
    const line3 = document.createElement('span');
    line3.textContent = 'that make it clearer.';
    const br = () => document.createElement('br');
    container.append(heading, br(), line1, br(), line2, br(), line3);
    document.body.appendChild(container);

    const textNode = line3.firstChild!;
    // selects "that" only, on the sentence's final wrapped line
    const selection = selectRange((range) => {
      range.setStart(textNode, 0);
      range.setEnd(textNode, 4);
    });

    expect(getContext(selection)).toBe(
      'If a chapter feels dense, there are usually examples nearby that make it clearer.',
    );

    container.remove();
  });

  it('does not pull text from a sibling line when the selection is inside its own line', () => {
    // mirrors a real PDF text layer: each line is its own absolutely-positioned sibling <span>.
    const container = document.createElement('div');
    const heading = document.createElement('span');
    heading.textContent = 'Appendix Three Glossary Index';
    const paragraph = document.createElement('span');
    paragraph.textContent = 'This handbook exists to help new engineers write cleaner, more maintainable code.';
    container.append(heading, paragraph);
    document.body.appendChild(container);

    const textNode = paragraph.firstChild!;
    const text = textNode.textContent!;
    const start = text.indexOf('handbook');
    const end = start + 'handbook'.length;
    const selection = selectRange((range) => {
      range.setStart(textNode, start);
      range.setEnd(textNode, end);
    });

    expect(getContext(selection)).toBe(
      'This handbook exists to help new engineers write cleaner, more maintainable code.',
    );

    container.remove();
  });

  it('does not pull in an unrelated block when the selection only touches the edges of two adjacent ones', () => {
    // mirrors the reported bug: dragging from the end of one paragraph into the start of the next
    // must not pull in every other line sharing the same flat text-layer container.
    const container = document.createElement('div');
    const first = document.createElement('span');
    first.textContent = 'If a project runs long, there will usually be extra notes about what went wrong.';
    const second = document.createElement('span');
    second.textContent = 'These are the kinds of mistakes that every experienced developer eventually makes.';
    const unrelated = document.createElement('span');
    unrelated.textContent = 'Appendix Four Revision History.';
    container.append(first, second, unrelated);
    document.body.appendChild(container);

    const startNode = first.firstChild!;
    const startText = startNode.textContent!;
    const endNode = second.firstChild!;
    const selection = selectRange((range) => {
      range.setStart(startNode, startText.indexOf('wrong'));
      range.setEnd(endNode, 'These'.length);
    });

    expect(getContext(selection)).toBe(
      'If a project runs long, there will usually be extra notes about what went wrong.These are the kinds of mistakes that every experienced developer eventually makes.',
    );

    container.remove();
  });

  it('resolves the full sentence when start and end sit under different, differently-shaped parent branches', () => {
    const container = document.createElement('div');
    // one sentence split across a <span><a> branch and a <div><strong> branch, followed by an
    // unrelated second sentence as a bare trailing text node.
    container.innerHTML = '<span>Before <a>middle</a></span><div><strong> end.</strong></div> Next sentence.';
    document.body.appendChild(container);

    const startNode = container.querySelector('a')!.firstChild!; // "middle"
    const endNode = container.querySelector('strong')!.firstChild!; // " end."
    const selection = selectRange((range) => {
      range.setStart(startNode, 0);
      range.setEnd(endNode, endNode.textContent!.length);
    });

    expect(getContext(selection)).toBe('Before middle end.');

    container.remove();
  });

  it('scopes to the nearest common ancestor, not sibling elements', () => {
    const container = document.createElement('div');
    const p1 = document.createElement('p');
    p1.textContent = 'Sentence in the first paragraph.';
    const p2 = document.createElement('p');
    p2.textContent = 'Sentence in the second paragraph.';
    // a real text-node gap between block siblings, as ordinary markup would have
    container.append(p1, document.createTextNode(' '), p2);
    document.body.appendChild(container);

    const textNode = p1.firstChild!;
    const selection = selectRange((range) => {
      range.setStart(textNode, 0);
      range.setEnd(textNode, 8);
    });

    expect(getContext(selection)).toBe('Sentence in the first paragraph.');

    container.remove();
  });

  it('does not treat a decimal point as a sentence break', () => {
    const p = document.createElement('p');
    p.textContent = 'The price is 3.14 dollars today. It was cheaper yesterday.';
    document.body.appendChild(p);

    const textNode = p.firstChild!;
    const text = textNode.textContent!;
    const start = text.indexOf('3.14');
    const end = start + '3.14'.length;
    const selection = selectRange((range) => {
      range.setStart(textNode, start);
      range.setEnd(textNode, end);
    });

    expect(getContext(selection)).toBe('The price is 3.14 dollars today.');

    p.remove();
  });

  it('picks only the relevant sentence out of a large amount of surrounding text', () => {
    const sentences = Array.from({ length: 50 }, (_, index) => `Sentence number ${index + 1} of the document.`);
    const p = document.createElement('p');
    p.textContent = sentences.join(' ');
    document.body.appendChild(p);

    const target = 'Sentence number 25 of the document.';
    const textNode = p.firstChild!;
    const text = textNode.textContent!;
    const start = text.indexOf(target) + 'Sentence number 25'.length - 2; // inside "25"
    const end = start + 2;
    const selection = selectRange((range) => {
      range.setStart(textNode, start);
      range.setEnd(textNode, end);
    });

    const context = getContext(selection);

    expect(context).toBe(target);
    expect(context.length).toBeLessThan(text.length / 10);

    p.remove();
  });

  it('keeps an abbreviation attached to its sentence when the selection spans the dot', () => {
    const p = document.createElement('p');
    p.textContent = 'Mr. Smith arrived late. He apologized to everyone.';
    document.body.appendChild(p);

    const textNode = p.firstChild!;
    const text = textNode.textContent!;
    // selects "Mr. Smith"
    const start = 0;
    const end = text.indexOf('Smith') + 'Smith'.length;
    const selection = selectRange((range) => {
      range.setStart(textNode, start);
      range.setEnd(textNode, end);
    });

    expect(getContext(selection)).toBe('Mr. Smith arrived late.');

    p.remove();
  });

  it('keeps an abbreviation attached when it and its sentence are split across sibling spans (forward)', () => {
    // a naive own-text regex sees "Mr." end with a period and stops expanding right there; only
    // asking the real sentence splitter (with "Smith arrived late." as context) knows it's not done.
    const container = document.createElement('div');
    container.innerHTML = '<span>Mr.</span><span> Smith arrived late.</span>';
    document.body.appendChild(container);

    const textNode = container.firstElementChild!.firstChild!; // "Mr."
    const selection = selectRange((range) => {
      range.setStart(textNode, 0);
      range.setEnd(textNode, 3);
    });

    expect(getContext(selection)).toBe('Mr. Smith arrived late.');

    container.remove();
  });

  it('keeps an abbreviation attached when it and its sentence are split across sibling spans (backward)', () => {
    // the mirror image of the forward case: "Smith" starts with a capital letter, so a naive check
    // assumes it's a fresh sentence start and never looks back far enough to find "Mr.".
    const container = document.createElement('div');
    container.innerHTML = '<span>Mr.</span><span> Smith arrived late.</span>';
    document.body.appendChild(container);

    const textNode = container.lastElementChild!.firstChild!; // " Smith arrived late."
    const text = textNode.textContent!;
    const start = text.indexOf('arrived');
    const end = start + 'arrived'.length;
    const selection = selectRange((range) => {
      range.setStart(textNode, start);
      range.setEnd(textNode, end);
    });

    expect(getContext(selection)).toBe('Mr. Smith arrived late.');

    container.remove();
  });

  it('keeps an abbreviation attached across a wrapped line, mirroring a real pdf.js line break', () => {
    // same as the sibling-span case above, but with the bare <br> pdf.js inserts between lines
    // sitting directly between the abbreviation and its continuation.
    const container = document.createElement('div');
    const abbreviation = document.createElement('span');
    abbreviation.textContent = 'Mr. ';
    const rest = document.createElement('span');
    rest.textContent = 'Smith arrived late.';
    container.append(abbreviation, document.createElement('br'), rest);
    document.body.appendChild(container);

    const textNode = rest.firstChild!;
    const selection = selectRange((range) => {
      range.setStart(textNode, 0);
      range.setEnd(textNode, 5); // "Smith"
    });

    expect(getContext(selection)).toBe('Mr. Smith arrived late.');

    container.remove();
  });

  it('keeps a middle-initial abbreviation attached when the selection sits entirely before it', () => {
    // mirrors the reported bug: a plain punctuation-based splitter misreads a single-capital-letter
    // initial like "P." as ending a sentence. Unlike the "Mr. Smith" case above, this selection
    // doesn't span the period at all - it's a single word entirely before it - so this only passes if
    // the initial is recognized as an abbreviation up front, not rescued by an overlapping selection.
    const heading = document.createElement('span');
    heading.textContent = 'Jordan P. Ellis Files';
    document.body.appendChild(heading);

    const textNode = heading.firstChild!;
    // selects "Jordan" only
    const selection = selectRange((range) => {
      range.setStart(textNode, 0);
      range.setEnd(textNode, 6);
    });

    expect(getContext(selection)).toBe('Jordan P. Ellis Files');

    heading.remove();
  });

  it('keeps a middle-initial heading intact inside a real PDF text layer', () => {
    // reproduces the exact reported bug: a book-series-style heading rendered inside react-pdf's
    // `.textLayer`, selecting only the first name.
    const textLayer = document.createElement('div');
    textLayer.className = 'textLayer';
    const heading = document.createElement('span');
    heading.textContent = 'Jordan P. Ellis Files';
    textLayer.append(heading);
    document.body.appendChild(textLayer);

    const textNode = heading.firstChild!;
    // selects "Jordan" only
    const selection = selectRange((range) => {
      range.setStart(textNode, 0);
      range.setEnd(textNode, 6);
    });

    expect(getContext(selection)).toBe('Jordan P. Ellis Files');

    textLayer.remove();
  });

  it('returns an empty string for a selection with no ranges', () => {
    const selection = window.getSelection()!;
    selection.removeAllRanges();

    expect(getContext(selection)).toBe('');
  });

  it('bounds expansion to the enclosing .textLayer, not a neighboring page', () => {
    // mirrors react-pdf's real output: each page gets its own `.textLayer` element, and multiple
    // pages can be mounted as siblings at once (virtualized scrolling).
    const root = document.createElement('div');

    const pageOne = document.createElement('div');
    pageOne.className = 'textLayer';
    const heading = document.createElement('span');
    heading.textContent = 'Appendix Three Glossary Index';
    const line1 = document.createElement('span');
    line1.textContent = 'This guide exists to help you learn faster. If a chapter feels dense, ';
    const line2 = document.createElement('span');
    line2.textContent = 'there are usually examples nearby ';
    const line3 = document.createElement('span');
    line3.textContent = 'that make it clearer.';
    const br = () => document.createElement('br');
    pageOne.append(heading, br(), line1, br(), line2, br(), line3);

    const pageTwo = document.createElement('div');
    pageTwo.className = 'textLayer';
    const pageTwoLine = document.createElement('span');
    pageTwoLine.textContent = 'Chapter Two starts here.';
    pageTwo.append(pageTwoLine);

    root.append(pageOne, pageTwo);
    document.body.appendChild(root);

    const textNode = line3.firstChild!;
    // selects "that" only, on the sentence's final wrapped line
    const selection = selectRange((range) => {
      range.setStart(textNode, 0);
      range.setEnd(textNode, 4);
    });

    expect(getContext(selection)).toBe(
      'If a chapter feels dense, there are usually examples nearby that make it clearer.',
    );

    root.remove();
  });

  it('reconstructs the same wrapped sentence without a .textLayer, plain-DOM setup', () => {
    // same shape as the .textLayer test above, minus the class - the selection sits entirely inside
    // one line of one page, so the generic scope-resolution path (climbing from the touched text node
    // to its containing page div) bounds it the same way, with no .textLayer hint needed.
    const root = document.createElement('div');

    const pageOne = document.createElement('div');
    const heading = document.createElement('span');
    heading.textContent = 'Appendix Three Glossary Index';
    const line1 = document.createElement('span');
    line1.textContent = 'This guide exists to help you learn faster. If a chapter feels dense, ';
    const line2 = document.createElement('span');
    line2.textContent = 'there are usually examples nearby ';
    const line3 = document.createElement('span');
    line3.textContent = 'that make it clearer.';
    const br = () => document.createElement('br');
    pageOne.append(heading, br(), line1, br(), line2, br(), line3);

    const pageTwo = document.createElement('div');
    const pageTwoLine = document.createElement('span');
    pageTwoLine.textContent = 'Chapter Two starts here.';
    pageTwo.append(pageTwoLine);

    root.append(pageOne, pageTwo);
    document.body.appendChild(root);

    const textNode = line3.firstChild!;
    // selects "that" only, on the sentence's final wrapped line
    const selection = selectRange((range) => {
      range.setStart(textNode, 0);
      range.setEnd(textNode, 4);
    });

    expect(getContext(selection)).toBe(
      'If a chapter feels dense, there are usually examples nearby that make it clearer.',
    );

    root.remove();
  });

  it('falls back to the raw selected text when the selection spans two different pages', () => {
    // dragging a selection across the virtualized page boundary must not merge unrelated pages.
    const root = document.createElement('div');

    const pageOne = document.createElement('div');
    pageOne.className = 'textLayer';
    const pageOneLine = document.createElement('span');
    pageOneLine.textContent = 'End of the first page.';
    pageOne.append(pageOneLine);

    const pageTwo = document.createElement('div');
    pageTwo.className = 'textLayer';
    const pageTwoLine = document.createElement('span');
    pageTwoLine.textContent = 'Start of the second page.';
    pageTwo.append(pageTwoLine);

    root.append(pageOne, pageTwo);
    document.body.appendChild(root);

    const startNode = pageOneLine.firstChild!;
    const startText = startNode.textContent!;
    const endNode = pageTwoLine.firstChild!;
    const selection = selectRange((range) => {
      range.setStart(startNode, startText.indexOf('first'));
      range.setEnd(endNode, 'Start'.length);
    });

    expect(getContext(selection)).toBe(selection.toString().trim());

    root.remove();
  });

  it('merges two adjacent blocks without a .textLayer hint, unlike the real react-pdf case above', () => {
    // same shape as the .textLayer fallback test above, minus the class - and here it does NOT fall
    // back. Without a .textLayer to bound against, findExpansionScope's generic path resolves to
    // `root` directly (the selection's two ends sit in different elements, so commonAncestorContainer
    // is already root, with no climbing needed), and each page-like div's own text already looks like
    // a complete sentence on its own, so expansion never even looks past it - the two divs' full text
    // ends up concatenated with no separator between them ("page.Start"), and since sentence-splitter
    // needs a space after a period to treat it as a sentence break, it reads that as one sentence. This
    // is exactly why .textLayer bounding exists for react-pdf specifically: real virtualized pages can
    // sit exactly this adjacently, and nothing in plain DOM structure alone flags that boundary.
    const root = document.createElement('div');

    const pageOne = document.createElement('div');
    const pageOneLine = document.createElement('span');
    pageOneLine.textContent = 'End of the first page.';
    pageOne.append(pageOneLine);

    const pageTwo = document.createElement('div');
    const pageTwoLine = document.createElement('span');
    pageTwoLine.textContent = 'Start of the second page.';
    pageTwo.append(pageTwoLine);

    root.append(pageOne, pageTwo);
    document.body.appendChild(root);

    const startNode = pageOneLine.firstChild!;
    const startText = startNode.textContent!;
    const endNode = pageTwoLine.firstChild!;
    const selection = selectRange((range) => {
      range.setStart(startNode, startText.indexOf('first'));
      range.setEnd(endNode, 'Start'.length);
    });

    expect(getContext(selection)).toBe('End of the first page.Start of the second page.');

    root.remove();
  });
});
