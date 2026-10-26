// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { parseSpendLimit } from './parseSpendLimit';

describe('parseSpendLimit', () => {
  it.each([
    ['2.50', 2.5],
    ['2,50', 2.5],
    [' 7 ', 7],
    [' 12.5 ', 12.5],
    ['0.01', 0.01],
  ])('reads %s as %s dollars', (draft, usd) => {
    expect(parseSpendLimit(draft)).toBe(usd);
  });

  it.each(['', '   ', '0', '-3', '2.5abc', 'abc'])('refuses %j', (draft) => {
    expect(parseSpendLimit(draft)).toBeNull();
  });
});
