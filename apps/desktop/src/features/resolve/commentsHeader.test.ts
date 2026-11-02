// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { headerPrimaryOf } from './commentsHeader';

const IDLE = {
  fixingThreads: 0,
  waitingFixes: 0,
  fixableThreads: 0,
  unpushedCommits: 0,
  hasOpenThreads: true,
};

describe('headerPrimaryOf', () => {
  it('idle: offers Fix with the thread count', () => {
    expect(headerPrimaryOf({ ...IDLE, fixableThreads: 4 })).toEqual({
      kind: 'fix',
      label: 'Fix 4 threads',
      isDisabled: false,
    });
  });

  it('fixing: is disabled and counts the threads in the run', () => {
    expect(headerPrimaryOf({ ...IDLE, fixingThreads: 4, fixableThreads: 2 })).toEqual({
      kind: 'fixing',
      label: 'Fixing 4 threads',
      isDisabled: true,
    });
  });

  it('ready: Apply N fixes wins over Fix and Push', () => {
    expect(
      headerPrimaryOf({ ...IDLE, waitingFixes: 3, fixableThreads: 2, unpushedCommits: 1 }),
    ).toMatchObject({ kind: 'apply', label: 'Apply 3 fixes' });
  });

  it('applied: Push counts commits, never fixes', () => {
    expect(headerPrimaryOf({ ...IDLE, unpushedCommits: 3 })).toMatchObject({
      kind: 'push',
      label: 'Push 3 commits',
    });
    expect(headerPrimaryOf({ ...IDLE, unpushedCommits: 1 })).toMatchObject({
      label: 'Push 1 commit',
    });
  });

  it('pushed: Request review when no thread is open', () => {
    expect(headerPrimaryOf({ ...IDLE, hasOpenThreads: false })).toMatchObject({
      kind: 'request_review',
      label: 'Request review',
    });
  });

  it('shows nothing while threads are open and nothing can move', () => {
    expect(headerPrimaryOf(IDLE)).toBeNull();
  });
});
