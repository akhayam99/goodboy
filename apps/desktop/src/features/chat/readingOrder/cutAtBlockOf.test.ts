// @vitest-environment happy-dom
import { afterEach, describe, expect, it } from 'vitest';
import { cutAtBlockOf } from './cutAtBlockOf';

type BlockSpec = {
  readonly tag: string;
  readonly top: number;
  readonly bottom: number;
};

type BoxParams = {
  readonly blocks: ReadonlyArray<BlockSpec>;
};

const rectOf = ({ top, bottom }: Omit<BlockSpec, 'tag'>): DOMRect =>
  new DOMRect(0, top, 0, bottom - top);

const boxWith = ({ blocks }: BoxParams): HTMLElement => {
  const box = document.createElement('div');
  box.style.lineHeight = '24px';
  box.getBoundingClientRect = () => rectOf({ top: 0, bottom: 1000 });
  const content = document.createElement('div');
  const last = blocks.at(-1);
  content.getBoundingClientRect = () =>
    rectOf({ top: 0, bottom: last === undefined ? 0 : last.bottom });
  box.appendChild(content);
  blocks.forEach(({ tag, top, bottom }) => {
    const block = document.createElement(tag);
    block.getBoundingClientRect = () => rectOf({ top, bottom });
    content.appendChild(block);
  });
  document.body.appendChild(box);
  return box;
};

afterEach(() => {
  document.body.innerHTML = '';
});

describe('cutAtBlockOf', () => {
  it('cuts at the bottom of the last whole block inside the line budget', () => {
    const box = boxWith({
      blocks: [
        { tag: 'p', top: 0, bottom: 72 },
        { tag: 'h2', top: 96, bottom: 120 },
        { tag: 'li', top: 128, bottom: 260 },
        { tag: 'h2', top: 284, bottom: 308 },
      ],
    });

    expect(cutAtBlockOf({ box, lines: 12 })).toEqual({ kind: 'block', px: 260 });
  });

  it('never ends the cut on a heading with no text under it', () => {
    const box = boxWith({
      blocks: [
        { tag: 'p', top: 0, bottom: 72 },
        { tag: 'h2', top: 96, bottom: 120 },
        { tag: 'p', top: 128, bottom: 320 },
      ],
    });

    expect(cutAtBlockOf({ box, lines: 12 })).toEqual({ kind: 'block', px: 72 });
  });

  it('falls back to a line cut when the first block alone passes the budget', () => {
    const box = boxWith({ blocks: [{ tag: 'p', top: 0, bottom: 600 }] });

    expect(cutAtBlockOf({ box, lines: 12 })).toEqual({ kind: 'lines' });
  });

  it('cuts nothing when the rendered answer fits the budget', () => {
    const box = boxWith({ blocks: [{ tag: 'p', top: 0, bottom: 120 }] });

    expect(cutAtBlockOf({ box, lines: 12 })).toEqual({ kind: 'fits' });
  });
});
