import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { MountId, ProjectId, SessionId } from '@goodboy/types';

const h = vi.hoisted(() => {
  const state = {
    sessionResolveThreads: {} as Record<string, ReadonlyArray<unknown>>,
    sessionResolveAttempts: {} as Record<string, ReadonlyArray<unknown>>,
    sessionSelectedPrNumber: {} as Record<string, number | null>,
    sessionGithub: {} as Record<string, unknown>,
    sessionMounts: {} as Record<string, ReadonlyArray<unknown>>,
    sessionProjectMounts: {} as Record<string, ReadonlyArray<unknown>>,
    sessionActiveMount: {} as Record<string, string>,
    sessions: [] as ReadonlyArray<unknown>,
    mountGithub: {} as Record<string, unknown>,
  };
  return { state, openReview: vi.fn(async () => ({ kind: 'opened' as const })) };
});

vi.mock('../../store', () => ({
  useAppStore: { getState: () => h.state },
}));
vi.mock('./openReview', () => ({ openReview: h.openReview }));

import { openReviewThread } from './openReviewThread';

const SESSION_ID = 'session-1' as SessionId;
const MOUNT_ID = 'mount-1' as MountId;
const OTHER_MOUNT_ID = 'mount-2' as MountId;
const PROJECT_ID = 'project-1' as ProjectId;

const seed = (): void => {
  h.state.sessionResolveThreads = {};
  h.state.sessionResolveAttempts = {};
  h.state.sessionSelectedPrNumber = {};
  h.state.sessionGithub = {};
  h.state.sessionMounts = {};
  h.state.sessionProjectMounts = {};
  h.state.sessionActiveMount = {};
  h.state.sessions = [{ id: SESSION_ID }];
  h.state.mountGithub = {};
};

beforeEach(() => {
  seed();
  h.openReview.mockClear();
});

describe('openReviewThread', () => {
  it('reads the pull request out of the comment link the transcript carries', async () => {
    h.state.sessionGithub = { [SESSION_ID]: { pr: { number: 9999 } } };

    await openReviewThread({
      sessionId: SESSION_ID,
      threadId: 'PRRT_1',
      prUrl: 'https://github.com/o/r/pull/9108#discussion_r1',
    });

    expect(h.openReview).toHaveBeenCalledWith({
      sessionId: SESSION_ID,
      destination: { kind: 'thread', mountId: null, prNumber: 9108, threadId: 'PRRT_1' },
    });
  });

  it('names the mount that carries the linked pull request', async () => {
    h.state.sessionProjectMounts = {
      [SESSION_ID]: [
        { mountId: MOUNT_ID, projectId: PROJECT_ID, worktreePath: '/a', repoRoot: '/a' },
        { mountId: OTHER_MOUNT_ID, projectId: PROJECT_ID, worktreePath: '/b', repoRoot: '/b' },
      ],
    };
    h.state.mountGithub = {
      [MOUNT_ID]: { prs: [{ number: 12 }] },
      [OTHER_MOUNT_ID]: { prs: [{ number: 9108 }] },
    };

    await openReviewThread({
      sessionId: SESSION_ID,
      threadId: 'PRRT_1',
      prUrl: 'https://github.com/o/r/pull/9108#discussion_r1',
    });

    expect(h.openReview).toHaveBeenCalledWith({
      sessionId: SESSION_ID,
      destination: {
        kind: 'thread',
        mountId: OTHER_MOUNT_ID,
        prNumber: 9108,
        threadId: 'PRRT_1',
      },
    });
  });

  it('opens a recorded thread against its own pull request, not the active one', async () => {
    h.state.sessionGithub = { [SESSION_ID]: { pr: { number: 9999 } } };
    h.state.sessionResolveThreads = {
      [SESSION_ID]: [{ threadId: 'PRRT_1', prNumber: 248, projectId: PROJECT_ID }],
    };
    h.state.sessionProjectMounts = {
      [SESSION_ID]: [
        { mountId: MOUNT_ID, projectId: PROJECT_ID, worktreePath: '/a', repoRoot: '/a' },
      ],
    };

    await openReviewThread({ sessionId: SESSION_ID, threadId: 'PRRT_1' });

    expect(h.openReview).toHaveBeenCalledWith({
      sessionId: SESSION_ID,
      destination: { kind: 'thread', mountId: MOUNT_ID, prNumber: 248, threadId: 'PRRT_1' },
    });
  });

  it('falls back to the pull request the resolver attempt ran against', async () => {
    h.state.sessionGithub = { [SESSION_ID]: { pr: { number: 9999 } } };
    h.state.sessionResolveAttempts = {
      [SESSION_ID]: [{ threadIds: ['PRRT_1', 'PRRT_2'], prNumber: 77 }],
    };

    await openReviewThread({ sessionId: SESSION_ID, threadId: 'PRRT_2' });

    expect(h.openReview).toHaveBeenCalledWith({
      sessionId: SESSION_ID,
      destination: { kind: 'thread', mountId: null, prNumber: 77, threadId: 'PRRT_2' },
    });
  });

  it('refuses to navigate when no pull request can be named', async () => {
    await expect(openReviewThread({ sessionId: SESSION_ID, threadId: 'PRRT_1' })).resolves.toEqual({
      kind: 'unavailable',
      reason: 'no_pull_request',
    });
    expect(h.openReview).not.toHaveBeenCalled();
  });
});
