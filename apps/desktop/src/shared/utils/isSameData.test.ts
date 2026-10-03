// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { isSameData } from './isSameData';

describe('isSameData', () => {
  it('treats rebuilt plain data as the same', () => {
    expect(
      isSameData({
        first: { pills: { isHead: true }, files: ['a.ts'] },
        second: { pills: { isHead: true }, files: ['a.ts'] },
      }),
    ).toBe(true);
  });

  it('sees a changed leaf deep inside', () => {
    expect(
      isSameData({
        first: { mark: { into: { mode: 'fixup' } } },
        second: { mark: { into: { mode: 'squash' } } },
      }),
    ).toBe(false);
  });

  it('compares functions by identity', () => {
    const onHover = () => undefined;
    expect(isSameData({ first: { onHover }, second: { onHover } })).toBe(true);
    expect(isSameData({ first: { onHover }, second: { onHover: () => undefined } })).toBe(false);
  });
});
