import { describe, expect, it } from 'vitest';
import type { PrCheckRun } from '@goodboy/types';
import { checksRollup } from './checksRollup';

const run = (conclusion: PrCheckRun['conclusion'], name = 'check'): PrCheckRun => ({
  name,
  conclusion,
  detailsUrl: null,
  durationMs: null,
});

describe('checksRollup', () => {
  it('says nothing when there is nothing to say', () => {
    expect(checksRollup({ checks: [] })).toBe('');
  });

  it('leads with the failures, then what is still running', () => {
    expect(
      checksRollup({
        checks: [run('success'), run('failure'), run('pending'), run('failure')],
      }),
    ).toBe('2 failed, 1 in progress, 1 passed');
  });

  it('folds the states with no plain-language name of their own', () => {
    expect(
      checksRollup({
        checks: [run('timed_out'), run('neutral'), run('stale'), run('action_required')],
      }),
    ).toBe('1 failed, 1 needs attention, 2 skipped');
  });
});
