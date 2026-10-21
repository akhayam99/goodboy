// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { sliceFreshTail } from './sliceFreshTail';

const tail = {
  pieces: [
    { key: 0, length: 3 },
    { key: 3, length: 5 },
  ],
  fadeMs: 220,
  rowStaggerMs: 40,
  maxStaggerRows: 8,
};

describe('sliceFreshTail', () => {
  it('gives the last text the newest characters of the newest pieces', () => {
    expect(sliceFreshTail({ tail, skip: 0, length: 6 })?.pieces).toEqual([
      { key: 0, length: 1 },
      { key: 3, length: 5 },
    ]);
  });

  it('gives an earlier text what is left once the later text took its share', () => {
    expect(sliceFreshTail({ tail, skip: 6, length: 10 })?.pieces).toEqual([{ key: 0, length: 2 }]);
  });

  it('gives nothing to a text before the fresh tail', () => {
    expect(sliceFreshTail({ tail, skip: 8, length: 4 })).toBeUndefined();
    expect(sliceFreshTail({ tail, skip: 0, length: 0 })).toBeUndefined();
  });
});
