import { describe, expect, it, vi } from 'vitest';
import { getContext } from '@/utils/selection';

const makeRange = (setup: (range: Range) => void): Range => {
  const range = document.createRange();
  setup(range);
  return range;
};

describe('getContext', () => {
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

    expect(getContext(range)).toEqual({ before: null, after: 'my girlfriend' });

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

    expect(getContext(range)).toEqual({ before: 'one two three', after: 'five six seven' });

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

    expect(getContext(range)).toEqual({ before: 'a b c', after: 'd e f' });

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

    expect(getContext(range)).toEqual({
      before: before.slice(-15).join(' '),
      after: after.slice(0, 15).join(' '),
    });

    p.remove();
  });

  it('returns every word, untruncated, when a side has exactly CONTEXT_WORDS words', () => {
    const words = Array.from({ length: 15 }, (_, index) => `word${index}`);
    const p = document.createElement('p');
    p.textContent = `${words.join(' ')} target ${words.join(' ')}`;
    document.body.appendChild(p);

    const textNode = p.firstChild!;
    const text = textNode.textContent!;
    const start = text.indexOf('target');
    const range = makeRange((r) => {
      r.setStart(textNode, start);
      r.setEnd(textNode, start + 'target'.length);
    });

    expect(getContext(range)).toEqual({ before: words.join(' '), after: words.join(' ') });

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

    expect(getContext(range)).toEqual({ before: 'I found something', after: 'we gonna be rich' });

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

    expect(getContext(range).after).toBeNull();

    p.remove();
  });

  it('returns null when the only remaining content on the before side has no real word characters', () => {
    const p = document.createElement('p');
    p.textContent = ',Hello world';
    document.body.appendChild(p);

    const textNode = p.firstChild!;
    // selects "Hello world", leaving only the leading "," as would-be "before" content
    const range = makeRange((r) => {
      r.setStart(textNode, 1);
      r.setEnd(textNode, textNode.textContent!.length);
    });

    expect(getContext(range).before).toBeNull();

    p.remove();
  });

  it('does not let a lone punctuation token, separated by whitespace, consume a slot in the word budget', () => {
    // 16 real words with a stray comma token wedged after the first one - the comma must not eat
    // one of the 15 slots, or the 16th real word (`word15`) would wrongly survive the cap instead.
    const words = Array.from({ length: 16 }, (_, index) => `word${index}`);
    const p = document.createElement('p');
    p.textContent = `target ${words[0]} , ${words.slice(1).join(' ')}`;
    document.body.appendChild(p);

    const textNode = p.firstChild!;
    const range = makeRange((r) => {
      r.setStart(textNode, 0);
      r.setEnd(textNode, 'target'.length);
    });

    expect(getContext(range).after).toBe(`${words[0]} , ${words.slice(1, 15).join(' ')}`);

    p.remove();
  });

  it('counts real dictionary words in a script with no spaces between them (e.g. Chinese), and caps the window the same way', () => {
    // 20 distinct 2-character words on each side, verified to round-trip exactly through
    // Intl.Segmenter - a run this long has no whitespace at all, so the old \S+ tokenizer would
    // have treated each entire side as a single "word" and never truncated it.
    const before = [
      '你好',
      '世界',
      '测试',
      '中文',
      '学习',
      '句子',
      '目标',
      '汉字',
      '阅读',
      '翻译',
      '词语',
      '段落',
      '文章',
      '语言',
      '文字',
      '历史',
      '未来',
      '城市',
      '朋友',
      '家庭',
    ];
    const after = [
      '厨房',
      '窗户',
      '桌子',
      '椅子',
      '杯子',
      '电脑',
      '手机',
      '钥匙',
      '雨伞',
      '眼镜',
      '钱包',
      '地图',
      '日记',
      '花园',
      '海洋',
      '山脉',
      '河流',
      '森林',
      '沙漠',
      '岛屿',
    ];
    const p = document.createElement('p');
    p.textContent = `${before.join('')}TARGET${after.join('')}`;
    document.body.appendChild(p);

    const textNode = p.firstChild!;
    const text = textNode.textContent!;
    const start = text.indexOf('TARGET');
    const range = makeRange((r) => {
      r.setStart(textNode, start);
      r.setEnd(textNode, start + 'TARGET'.length);
    });

    expect(getContext(range)).toEqual({
      before: before.slice(-15).join(''),
      after: after.slice(0, 15).join(''),
    });

    p.remove();
  });

  it('treats a non-breaking space as a word separator, not as part of the surrounding word', () => {
    const p = document.createElement('p');
    p.textContent = 'foo bar target baz qux';
    document.body.appendChild(p);

    const textNode = p.firstChild!;
    const text = textNode.textContent!;
    const start = text.indexOf('target');
    const range = makeRange((r) => {
      r.setStart(textNode, start);
      r.setEnd(textNode, start + 'target'.length);
    });

    expect(getContext(range)).toEqual({ before: 'foo bar', after: 'baz qux' });

    p.remove();
  });

  it('returns null on both sides when the selection spans the entire scope', () => {
    const p = document.createElement('p');
    p.textContent = 'only text here';
    document.body.appendChild(p);

    const textNode = p.firstChild!;
    const range = makeRange((r) => {
      r.setStart(textNode, 0);
      r.setEnd(textNode, textNode.textContent!.length);
    });

    expect(getContext(range)).toEqual({ before: null, after: null });

    p.remove();
  });

  it('resolves offsets from an element-boundary Range, not just text-node boundaries', () => {
    const container = document.createElement('div');
    container.innerHTML = '<span>alpha beta</span><span>gamma</span><span>delta epsilon</span>';
    document.body.appendChild(container);

    // selects the entire middle <span> via child-index offsets on the container, rather than a
    // text-node offset
    const range = makeRange((r) => {
      r.setStart(container, 1);
      r.setEnd(container, 2);
    });

    expect(getContext(range)).toEqual({ before: 'alpha beta', after: 'delta epsilon' });

    container.remove();
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

    expect(getContext(range)).toEqual({
      before: null,
      after: 'in the first paragraph words in the second paragraph',
    });

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

    expect(getContext(range)).toEqual({ before: 'end of the', after: 'page' });

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

    expect(getContext(range)).toEqual({ before: null, after: null });

    root.remove();
  });

  it('returns null on both sides when only one end of the selection is inside a .textLayer', () => {
    // e.g. a selection dragged from PDF text out into the surrounding, non-.textLayer chrome.
    const root = document.createElement('div');

    const layer = document.createElement('div');
    layer.className = 'textLayer';
    layer.textContent = 'inside the text layer';

    const outside = document.createElement('div');
    outside.textContent = 'outside any layer';

    root.append(layer, outside);
    document.body.appendChild(root);

    const startNode = layer.firstChild!;
    const endNode = outside.firstChild!;
    const range = makeRange((r) => {
      r.setStart(startNode, 0);
      r.setEnd(endNode, 'outside'.length);
    });

    expect(getContext(range)).toEqual({ before: null, after: null });

    root.remove();
  });

  it('resolves before and after together from a single Range', () => {
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

    expect(getContext(range)).toEqual({ before: 'Hello', after: 'beautiful world' });

    p.remove();
  });

  it('treats a pdf.js line-wrap <br> as a word separator, not as glue between the surrounding words', () => {
    const layer = document.createElement('div');
    layer.className = 'textLayer';
    layer.innerHTML = '<span>final</span><br><span>word target here</span>';
    document.body.appendChild(layer);

    const textNode = layer.children[2].firstChild!;
    const text = textNode.textContent!;
    const start = text.indexOf('target');
    const range = makeRange((r) => {
      r.setStart(textNode, start);
      r.setEnd(textNode, start + 'target'.length);
    });

    expect(getContext(range)).toEqual({ before: 'final word', after: 'here' });

    layer.remove();
  });

  it('handles multiple line-wrap <br>s in the same scope, not just one', () => {
    const layer = document.createElement('div');
    layer.className = 'textLayer';
    layer.innerHTML = '<span>first line</span><br><span>second line</span><br><span>third target line</span>';
    document.body.appendChild(layer);

    const textNode = layer.children[4].firstChild!;
    const text = textNode.textContent!;
    const start = text.indexOf('target');
    const range = makeRange((r) => {
      r.setStart(textNode, start);
      r.setEnd(textNode, start + 'target'.length);
    });

    expect(getContext(range)).toEqual({ before: 'first line second line third', after: 'line' });

    layer.remove();
  });

  it('returns null on both sides and logs the error when a DOM operation throws', () => {
    const p = document.createElement('p');
    p.textContent = 'hello world';
    document.body.appendChild(p);

    const range = makeRange((r) => {
      r.setStart(p.firstChild!, 0);
      r.setEnd(p.firstChild!, 5);
    });

    const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const createRangeSpy = vi.spyOn(document, 'createRange').mockImplementation(() => {
      throw new Error('boom');
    });

    expect(getContext(range)).toEqual({ before: null, after: null });
    expect(consoleErrorSpy).toHaveBeenCalledWith(expect.any(Error));

    createRangeSpy.mockRestore();
    consoleErrorSpy.mockRestore();
    p.remove();
  });
});
