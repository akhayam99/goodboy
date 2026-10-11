import { describe, expect, it } from 'vitest';
import {
  briefFromIssuesLabel,
  pickIssuesLabel,
  startFromIssuesLabel,
  willCloseLine,
} from './startCopy';

const ids = (count: number): ReadonlyArray<string> =>
  ['HL-204', 'HL-211', 'HL-212', 'HL-213', 'HL-214'].slice(0, count);

describe('the start labels for one to five issues', () => {
  it('names the single issue at one', () => {
    expect(pickIssuesLabel({ identifiers: ids(1) })).toBe('Pick HL-204');
    expect(startFromIssuesLabel({ identifiers: ids(1) })).toBe('Start from HL-204');
    expect(briefFromIssuesLabel({ identifiers: ids(1) })).toBe('Brief from HL-204');
  });

  it('names the first and counts the others at two', () => {
    expect(pickIssuesLabel({ identifiers: ids(2) })).toBe('Pick 2 issues');
    expect(startFromIssuesLabel({ identifiers: ids(2) })).toBe('Start from HL-204 and 1 more');
    expect(briefFromIssuesLabel({ identifiers: ids(2) })).toBe('Brief from HL-204 and 1 more');
  });

  it('keeps the same shape at five', () => {
    expect(pickIssuesLabel({ identifiers: ids(5) })).toBe('Pick 5 issues');
    expect(startFromIssuesLabel({ identifiers: ids(5) })).toBe('Start from HL-204 and 4 more');
  });

  it('lists every closing issue and says nothing when none closes', () => {
    expect(willCloseLine({ identifiers: ['HL-204', 'HL-211'] })).toBe(
      'Will close HL-204, HL-211 when merged',
    );
    expect(willCloseLine({ identifiers: [] })).toBeNull();
  });
});
