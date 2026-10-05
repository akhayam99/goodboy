// @vitest-environment node
import { describe, expect, it } from 'vitest';
import type { ResolveStage, ResolveThread, ResolveThreadState } from '@goodboy/types';
import { isFixableThread, isRunFailedThread } from './fixableComments';

const thread = ({
  threadId = 't',
  stage,
  state,
  stateReason = null,
}: {
  readonly threadId?: string;
  readonly stage: ResolveStage;
  readonly state: ResolveThreadState;
  readonly stateReason?: string | null;
}): ResolveThread => ({ threadId, stage, state, stateReason }) as unknown as ResolveThread;

describe('fixable comments', () => {
  it('takes an open comment and a comment the run could not fix', () => {
    expect(isFixableThread({ thread: thread({ stage: 'new', state: 'open' }) })).toBe(true);
    expect(
      isFixableThread({
        thread: thread({ stage: 'failed', state: 'failed', stateReason: 'provider_error' }),
      }),
    ).toBe(true);
  });

  it('leaves out a comment that needs an answer, is working, ready, done or parked', () => {
    const stages: ReadonlyArray<readonly [ResolveStage, ResolveThreadState]> = [
      ['asking', 'needs_answer'],
      ['working', 'working'],
      ['proposed', 'fixed'],
      ['approved', 'fixed'],
      ['publishing', 'publishing'],
      ['parked', 'open'],
      ['resolved', 'closed'],
    ];
    for (const [stage, state] of stages) {
      expect(isFixableThread({ thread: thread({ stage, state }) })).toBe(false);
    }
  });

  it('leaves out a push that failed, it is retried from the push, not fixed again', () => {
    const push = thread({
      stage: 'failed',
      state: 'failed',
      stateReason: 'publication_failed:push',
    });
    expect(isRunFailedThread({ thread: push })).toBe(false);
    expect(isFixableThread({ thread: push })).toBe(false);
  });

  it('keeps open and could-not-fix comments out of a mixed list, in order', () => {
    const threads = [
      thread({ threadId: 'a', stage: 'new', state: 'open' }),
      thread({ threadId: 'b', stage: 'asking', state: 'needs_answer' }),
      thread({ threadId: 'c', stage: 'failed', state: 'failed' }),
    ];
    expect(
      threads.filter((item) => isFixableThread({ thread: item })).map((item) => item.threadId),
    ).toEqual(['a', 'c']);
  });
});
