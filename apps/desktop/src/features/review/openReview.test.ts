import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { MountId, SessionId } from '@goodboy/types';

const h = vi.hoisted(() => {
  const state = {
    openReviewTarget: vi.fn(async () => ({ kind: 'opened' as const })),
  };
  return { state };
});

vi.mock('../../store', () => ({
  useAppStore: { getState: () => h.state },
}));

import { openReview } from './openReview';

const SESSION_ID = 'session-1' as SessionId;
const MOUNT_ID = 'mount-1' as MountId;

beforeEach(() => {
  h.state.openReviewTarget.mockClear();
});

describe('openReview', () => {
  it('asks for the review home when the caller names no target', async () => {
    await openReview({ sessionId: SESSION_ID });

    expect(h.state.openReviewTarget).toHaveBeenCalledWith({ sessionId: SESSION_ID });
  });

  it('carries the mount, the pull request, the thread and the mode to the store', async () => {
    await openReview({
      sessionId: SESSION_ID,
      destination: { kind: 'thread', mountId: MOUNT_ID, prNumber: 248, threadId: 'PRRT_7' },
      mode: 'pr_activity',
    });

    expect(h.state.openReviewTarget).toHaveBeenCalledWith({
      sessionId: SESSION_ID,
      destination: { kind: 'thread', mountId: MOUNT_ID, prNumber: 248, threadId: 'PRRT_7' },
      mode: 'pr_activity',
    });
  });

  it('hands the caller the outcome instead of resolving before the target does', async () => {
    h.state.openReviewTarget.mockResolvedValueOnce({
      kind: 'unavailable',
      reason: 'no_thread',
    } as never);

    await expect(
      openReview({
        sessionId: SESSION_ID,
        destination: { kind: 'thread', mountId: null, prNumber: 248, threadId: 'PRRT_9' },
      }),
    ).resolves.toEqual({
      kind: 'unavailable',
      reason: 'no_thread',
    });
  });
});
