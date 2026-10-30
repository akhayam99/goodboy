// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { stepsLabelOf } from './stepsLabelOf';

const upTo = (last: number): ReadonlyArray<number> =>
  Array.from({ length: last }, (_, index) => index + 1);

describe('stepsLabelOf', () => {
  it.each([
    [[3], 5, 'step 3 of 5'],
    [[1, 2], 6, 'steps 1 and 2 of 6'],
    [[1, 2, 3], null, 'steps 1 to 3'],
    [upTo(26), null, 'steps 1 to 26'],
    [[], 4, '4 steps'],
    [[], null, 'steps'],
  ])('says %j of %j as %j', (numbers, total, expected) => {
    expect(stepsLabelOf({ numbers, total })).toBe(expected);
  });

  it('gives a count, never the numbers, when the steps are not in a row', () => {
    const numbers = upTo(26).filter((step) => step !== 13 && step !== 18);

    expect(stepsLabelOf({ numbers, total: 26 })).toBe('24 of 26 steps');
    expect(stepsLabelOf({ numbers, total: null })).toBe('24 steps');
    expect(stepsLabelOf({ numbers: [1, 4], total: 5 })).toBe('2 of 5 steps');
  });
});
