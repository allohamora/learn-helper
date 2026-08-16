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
    heading.textContent = 'Robert C. Martin Series';
    const line1 = document.createElement('span');
    line1.textContent = 'The mission of this series is to improve the craft. If the book is ';
    const line2 = document.createElement('span');
    line2.textContent = 'about managing, there ';
    const line3 = document.createElement('span');
    line3.textContent = 'will be lots of case studies from real projects.';
    const br = () => document.createElement('br');
    container.append(heading, br(), line1, br(), line2, br(), line3);
    document.body.appendChild(container);

    const textNode = line3.firstChild!;
    // selects "will" only, on the sentence's final wrapped line
    const selection = selectRange((range) => {
      range.setStart(textNode, 0);
      range.setEnd(textNode, 4);
    });

    expect(getContext(selection)).toBe(
      'If the book is about managing, there will be lots of case studies from real projects.',
    );

    container.remove();
  });

  it('does not pull text from a sibling line when the selection is inside its own line', () => {
    // mirrors a real PDF text layer: each line is its own absolutely-positioned sibling <span>.
    const container = document.createElement('div');
    const heading = document.createElement('span');
    heading.textContent = 'Robert C. Martin Series';
    const paragraph = document.createElement('span');
    paragraph.textContent = 'The mission of this series is to improve the state of the art of software craftsmanship.';
    container.append(heading, paragraph);
    document.body.appendChild(container);

    const textNode = paragraph.firstChild!;
    const text = textNode.textContent!;
    const start = text.indexOf('mission');
    const end = start + 'mission'.length;
    const selection = selectRange((range) => {
      range.setStart(textNode, start);
      range.setEnd(textNode, end);
    });

    expect(getContext(selection)).toBe(
      'The mission of this series is to improve the state of the art of software craftsmanship.',
    );

    container.remove();
  });

  it('does not pull in an unrelated block when the selection only touches the edges of two adjacent ones', () => {
    // mirrors the reported bug: dragging from the end of one paragraph into the start of the next
    // must not pull in every other line sharing the same flat text-layer container.
    const container = document.createElement('div');
    const first = document.createElement('span');
    first.textContent = 'If the book is about managing, there will be lots of case studies from real projects.';
    const second = document.createElement('span');
    second.textContent = 'These are the books that all serious practitioners will have on their bookshelves.';
    const unrelated = document.createElement('span');
    unrelated.textContent = 'Managing Agile Projects Sanjiv Augustine.';
    container.append(first, second, unrelated);
    document.body.appendChild(container);

    const startNode = first.firstChild!;
    const startText = startNode.textContent!;
    const endNode = second.firstChild!;
    const selection = selectRange((range) => {
      range.setStart(startNode, startText.indexOf('projects'));
      range.setEnd(endNode, 'These'.length);
    });

    expect(getContext(selection)).toBe(
      'If the book is about managing, there will be lots of case studies from real projects.These are the books that all serious practitioners will have on their bookshelves.',
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
    // Intl.Segmenter has no abbreviation dictionary, so it incorrectly treats "Mr." as its own
    // sentence. A selection spanning the abbreviation and the text after it still joins both
    // segments back together, since getContext includes every segment the selection overlaps.
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

  it('threads an explicit locale through to Intl.Segmenter', () => {
    const p = document.createElement('p');
    p.textContent = 'Only one sentence here.';
    document.body.appendChild(p);

    const textNode = p.firstChild!;
    const selection = selectRange((range) => {
      range.setStart(textNode, 0);
      range.setEnd(textNode, 4);
    });

    const mutableIntl = Intl as unknown as { Segmenter: typeof Intl.Segmenter };
    const originalSegmenter = mutableIntl.Segmenter;
    const usedLocales: unknown[] = [];
    class TrackingSegmenter extends originalSegmenter {
      constructor(...args: ConstructorParameters<typeof Intl.Segmenter>) {
        super(...args);
        usedLocales.push(args[0]);
      }
    }
    mutableIntl.Segmenter = TrackingSegmenter;

    getContext(selection, 'fr');

    mutableIntl.Segmenter = originalSegmenter;
    p.remove();

    expect(usedLocales).toContain('fr');
  });

  it('falls back to the raw selected text when Intl.Segmenter is unsupported', () => {
    const p = document.createElement('p');
    p.textContent = 'First sentence. Second sentence.';
    document.body.appendChild(p);

    const textNode = p.firstChild!;
    const selection = selectRange((range) => {
      range.setStart(textNode, 0);
      range.setEnd(textNode, 5);
    });

    const mutableIntl = Intl as unknown as { Segmenter?: typeof Intl.Segmenter };
    const originalSegmenter = mutableIntl.Segmenter;
    delete mutableIntl.Segmenter;

    expect(getContext(selection)).toBe(selection.toString().trim());

    mutableIntl.Segmenter = originalSegmenter;
    p.remove();
  });

  it('returns an empty string for a selection with no ranges', () => {
    const selection = window.getSelection()!;
    selection.removeAllRanges();

    expect(getContext(selection)).toBe('');
  });
});
