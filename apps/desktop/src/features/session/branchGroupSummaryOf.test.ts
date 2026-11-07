// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { branchGroupSummaryOf } from './branchGroupSummaryOf';

describe('branchGroupSummaryOf', () => {
  it('reads the pull request first and then only the counts that are not zero', () => {
    expect(
      branchGroupSummaryOf({
        counts: { needsYou: 1, running: 2, finished: 3 },
        fact: '#318 Open',
      }),
    ).toBe('#318 Open, 1 needs you, 2 running, 3 finished');
  });

  it('says need for more than one run', () => {
    expect(
      branchGroupSummaryOf({ counts: { needsYou: 2, running: 0, finished: 0 }, fact: null }),
    ).toBe('2 need you');
  });

  it('is empty for a group with nothing to count', () => {
    expect(
      branchGroupSummaryOf({ counts: { needsYou: 0, running: 0, finished: 0 }, fact: null }),
    ).toBe('');
  });
});
