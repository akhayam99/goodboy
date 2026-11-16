// @vitest-environment node
import { describe, expect, it } from 'vitest';
import type { SummaryStatus } from './summaryStatusOf';
import { summaryStatusWordOf } from './summaryStatusWordOf';

const BASE: SummaryStatus = { tone: 'working', line: null, blockers: [], facts: [], stepCount: 0 };

describe('summaryStatusWordOf', () => {
  it('counts what the summary says instead of naming a run state', () => {
    expect(summaryStatusWordOf({ status: { ...BASE, tone: 'blocked', blockers: ['a'] } })).toBe(
      '1 blocker',
    );
    expect(
      summaryStatusWordOf({ status: { ...BASE, tone: 'blocked', blockers: ['a', 'b'] } }),
    ).toBe('2 blockers');
    expect(summaryStatusWordOf({ status: { ...BASE, stepCount: 1 } })).toBe('1 step left');
    expect(summaryStatusWordOf({ status: { ...BASE, stepCount: 4 } })).toBe('4 steps left');
    expect(summaryStatusWordOf({ status: { ...BASE, tone: 'done' } })).toBe('No steps left');
  });
});
