import { describe, expect, it } from 'vitest';
import { stateWord } from './stateWord';

describe('stateWord', () => {
  it.each([
    ['opened', 'Open'],
    ['OPEN', 'Open'],
    ['merged', 'Merged'],
    ['DECLINED', 'Declined'],
    ['unresolved', 'Unresolved'],
    ['in_progress', 'In progress'],
    [null, 'Open'],
  ] as const)('names %s as %s', (value, expected) => {
    expect(stateWord({ value })).toBe(expected);
  });
});
