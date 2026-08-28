import { describe, expect, it } from 'vitest';
import { getAfter, getBefore } from '@/utils/selection';

const makeRange = (setup: (range: Range) => void): Range => {
  const range = document.createRange();
  setup(range);
  return range;
};

describe('getBefore / getAfter', () => {
  it('returns null on a side with nothing left, and the real words on the other', () => {
    const p = document.createElement('p');
    p.textContent = 'hello my girlfriend';
    document.body.appendChild(p);

    const textNode = p.firstChild!;
    // selects "hello"
    const range = makeRange((r) => {
      r.setStart(textNode, 0);
      r.setEnd(textNode, 5);
    });

    expect(getBefore(range)).toBeNull();
    expect(getAfter(range)).toBe('my girlfriend');

    p.remove();
  });

  it('returns the words on both sides of a mid-text selection', () => {
    const p = document.createElement('p');
    p.textContent = 'one two three four five six seven';
    document.body.appendChild(p);

    const textNode = p.firstChild!;
    const text = textNode.textContent!;
    const start = text.indexOf('four');
    const end = start + 'four'.length;
    const range = makeRange((r) => {
      r.setStart(textNode, start);
      r.setEnd(textNode, end);
    });

    expect(getBefore(range)).toBe('one two three');
    expect(getAfter(range)).toBe('five six seven');

    p.remove();
  });

  it('returns whatever is available when there are fewer than CONTEXT_WORDS words', () => {
    const p = document.createElement('p');
    p.textContent = 'a b c target d e f';
    document.body.appendChild(p);

    const textNode = p.firstChild!;
    const text = textNode.textContent!;
    const start = text.indexOf('target');
    const end = start + 'target'.length;
    const range = makeRange((r) => {
      r.setStart(textNode, start);
      r.setEnd(textNode, end);
    });

    expect(getBefore(range)).toBe('a b c');
    expect(getAfter(range)).toBe('d e f');

    p.remove();
  });

  it('caps the window at CONTEXT_WORDS words on each side', () => {
    const before = Array.from({ length: 40 }, (_, index) => `before${index}`);
    const after = Array.from({ length: 40 }, (_, index) => `after${index}`);
    const p = document.createElement('p');
    p.textContent = `${before.join(' ')} target ${after.join(' ')}`;
    document.body.appendChild(p);

    const textNode = p.firstChild!;
    const text = textNode.textContent!;
    const start = text.indexOf('target');
    const end = start + 'target'.length;
    const range = makeRange((r) => {
      r.setStart(textNode, start);
      r.setEnd(textNode, end);
    });

    expect(getBefore(range)).toBe(before.slice(-15).join(' '));
    expect(getAfter(range)).toBe(after.slice(0, 15).join(' '));

    p.remove();
  });

  it('flattens text split across arbitrarily nested and sibling tags', () => {
    // mirrors a PDF text-layer shape: many spans, some nested, forming one flowing line.
    const container = document.createElement('div');
    container.innerHTML =
      '<span>I found </span><span><b>some<i>thing</i></b></span><span> dude we gonna </span><span>be rich</span>';
    document.body.appendChild(container);

    // selects "dude", inside the third span
    const textNode = container.children[2].firstChild!;
    const text = textNode.textContent!;
    const start = text.indexOf('dude');
    const range = makeRange((r) => {
      r.setStart(textNode, start);
      r.setEnd(textNode, start + 'dude'.length);
    });

    expect(getBefore(range)).toBe('I found something');
    expect(getAfter(range)).toBe('we gonna be rich');

    container.remove();
  });

  it('returns null when the only remaining content on a side has no real word characters', () => {
    const p = document.createElement('p');
    p.textContent = 'Hello world,';
    document.body.appendChild(p);

    const textNode = p.firstChild!;
    // selects "Hello world", leaving only the trailing "," as would-be "after" content
    const range = makeRange((r) => {
      r.setStart(textNode, 0);
      r.setEnd(textNode, 'Hello world'.length);
    });

    expect(getAfter(range)).toBeNull();

    p.remove();
  });

  it('scopes to the shared container, and the window can cross into a sibling block without a .textLayer hint', () => {
    const container = document.createElement('div');
    const p1 = document.createElement('p');
    p1.textContent = 'words in the first paragraph';
    const p2 = document.createElement('p');
    p2.textContent = 'words in the second paragraph';
    // a real text-node gap between block siblings, as ordinary markup would have
    container.append(p1, document.createTextNode(' '), p2);
    document.body.appendChild(container);

    const textNode = p1.firstChild!;
    const range = makeRange((r) => {
      r.setStart(textNode, 0);
      r.setEnd(textNode, 5); // "words"
    });

    expect(getBefore(range)).toBeNull();
    expect(getAfter(range)).toBe('in the first paragraph words in the second paragraph');

    container.remove();
  });

  it('bounds the window to the enclosing .textLayer, not a neighboring page', () => {
    // mirrors react-pdf's real output: each page gets its own `.textLayer` element, and multiple
    // pages can be mounted as siblings at once (virtualized scrolling).
    const root = document.createElement('div');

    const pageOne = document.createElement('div');
    pageOne.className = 'textLayer';
    pageOne.textContent = 'end of the first page';

    const pageTwo = document.createElement('div');
    pageTwo.className = 'textLayer';
    pageTwo.textContent = 'start of the second page';

    root.append(pageOne, pageTwo);
    document.body.appendChild(root);

    const textNode = pageOne.firstChild!;
    const text = textNode.textContent!;
    const start = text.indexOf('first');
    const range = makeRange((r) => {
      r.setStart(textNode, start);
      r.setEnd(textNode, start + 'first'.length);
    });

    expect(getBefore(range)).toBe('end of the');
    expect(getAfter(range)).toBe('page');

    root.remove();
  });

  it('returns null on both sides when the selection spans two different pages', () => {
    // dragging a selection across the virtualized page boundary must not merge unrelated pages.
    const root = document.createElement('div');

    const pageOne = document.createElement('div');
    pageOne.className = 'textLayer';
    const pageOneLine = document.createElement('span');
    pageOneLine.textContent = 'end of the first page';
    pageOne.append(pageOneLine);

    const pageTwo = document.createElement('div');
    pageTwo.className = 'textLayer';
    const pageTwoLine = document.createElement('span');
    pageTwoLine.textContent = 'start of the second page';
    pageTwo.append(pageTwoLine);

    root.append(pageOne, pageTwo);
    document.body.appendChild(root);

    const startNode = pageOneLine.firstChild!;
    const startText = startNode.textContent!;
    const endNode = pageTwoLine.firstChild!;
    const range = makeRange((r) => {
      r.setStart(startNode, startText.indexOf('first'));
      r.setEnd(endNode, 'start'.length);
    });

    expect(getBefore(range)).toBeNull();
    expect(getAfter(range)).toBeNull();

    root.remove();
  });

  it('resolves getBefore and getAfter independently on the same Range', () => {
    const p = document.createElement('p');
    p.textContent = 'Hello my beautiful world';
    document.body.appendChild(p);

    const textNode = p.firstChild!;
    const text = textNode.textContent!;
    const start = text.indexOf('my');
    const end = start + 'my'.length;
    const range = makeRange((r) => {
      r.setStart(textNode, start);
      r.setEnd(textNode, end);
    });

    expect(getBefore(range)).toBe('Hello');
    expect(getAfter(range)).toBe('beautiful world');

    p.remove();
  });
});
