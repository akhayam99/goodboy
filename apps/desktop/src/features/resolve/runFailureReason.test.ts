// @vitest-environment node
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
        attempt: attempt('every provider is over its spend cap'),
      }),
    ).toBe('The run failed: every provider is over its spend cap');
  });

  it.each([
    ['failed:interrupted', 'every provider is over its spend cap'],
    ['failed:interrupted', 'provider exited with code 1'],
    ['interrupted', 'rate limited'],
  ])('lets the real attempt error win over the %s thread code', (reason, error) => {
    expect(runFailureReason({ thread: thread(reason), attempt: attempt(error) })).toBe(
      `The run failed: ${error}`,
    );
  });

  it('keeps the interrupted wording when the attempt error is only interrupted', () => {
    expect(
      runFailureReason({ thread: thread('failed:interrupted'), attempt: attempt('interrupted') }),
    ).toBe('The run ended before the resolver reported a result');
  });

  it('keeps a specific thread reason over an attempt error', () => {
    expect(
      runFailureReason({ thread: thread('missing_result'), attempt: attempt('something else') }),
    ).toBe('The resolver finished without reporting a result for this thread');
  });

  it('says no reason was recorded instead of a generic error', () => {
    expect(runFailureReason({ thread: thread(null), attempt: null })).toBe(
      'The run failed and no reason was recorded',
    );
  });
});
