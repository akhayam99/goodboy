import { describe, expect, it } from 'vitest';
import type { ResolveAttempt, ResolveThread } from '@goodboy/types';
import { runFailureReason } from './runFailureReason';

const thread = (stateReason: string | null) => ({ stateReason }) as ResolveThread;
const attempt = (error: string | null) => ({ error }) as ResolveAttempt;

describe('runFailureReason', () => {
  it.each([
    ['interrupted', 'The run ended before the resolver reported a result'],
    ['failed:interrupted', 'The run ended before the resolver reported a result'],
    ['missing_result', 'The resolver finished without reporting a result for this thread'],
    [
      'missing_result:proposed_fix',
      'The resolver finished without reporting a result for this thread',
    ],
    ['target_unresolved', 'The worktree for this thread is no longer available'],
  ])('maps the thread reason %s', (reason, expected) => {
    expect(runFailureReason({ thread: thread(reason), attempt: null })).toBe(expected);
  });

  it('quotes the attempt error when the thread carries no known reason', () => {
    expect(
      runFailureReason({
        thread: thread(null),
        attempt: attempt('every provider is over its budget cap'),
      }),
    ).toBe('The run failed: every provider is over its budget cap');
  });

  it('says no reason was recorded instead of a generic error', () => {
    expect(runFailureReason({ thread: thread(null), attempt: null })).toBe(
      'The run failed and no reason was recorded',
    );
  });
});
