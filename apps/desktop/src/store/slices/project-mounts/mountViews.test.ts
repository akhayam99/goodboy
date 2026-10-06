// @vitest-environment node
import { describe, expect, it, vi } from 'vitest';
import type { SessionId, SessionMountView } from '@goodboy/types';

vi.mock('../../../shared/lib/db', () => ({ tauriDatabase: {} }));

import { applyMountViews } from './mountViews';
import type { SetFn } from './types';

const SESSION_ID = 'session-views' as SessionId;

const viewOf = (overrides: Record<string, unknown>): SessionMountView =>
  ({
    id: 'mount-api',
    sessionId: SESSION_ID,
    projectId: 'project-api',
    mountName: 'api',
    repoRoot: '/repos/api',
    branch: 'ak/feat',
    baseBranch: null,
    worktreePath: '/container/api',
    lastWorktreePath: '/container/api',
    parallelIndex: 0,
    isAttached: true,
    diskState: 'present',
    revision: 1,
    createdAt: '2026-01-01T00:00:00.000Z',
    repoSlug: null,
    ...overrides,
  }) as never;

const applied = (views: ReadonlyArray<SessionMountView>) => {
  let state: Record<string, unknown> = {
    sessions: [],
    sessionActiveMount: {},
    sessionBranches: {},
    sessionMounts: {},
    sessionWorktreeRecords: {},
    sessionProjectMounts: {},
    sessionWorktrees: {},
  };
  const set = ((update: (previous: Record<string, unknown>) => Record<string, unknown>) => {
    state = { ...state, ...update(state) };
  }) as unknown as SetFn;
  applyMountViews({ set, sessionId: SESSION_ID, views });
  return state as {
    readonly sessionWorktreeRecords: Record<string, ReadonlyArray<{ readonly id: string }>>;
    readonly sessionProjectMounts: Record<string, ReadonlyArray<{ readonly mountId: string }>>;
  };
};

describe('applyMountViews', () => {
  it('keeps a detached mount out of the session worktree records and the project mounts', () => {
    const state = applied([
      viewOf({}),
      viewOf({ id: 'mount-web', projectId: 'project-web', isAttached: false }),
    ]);

    expect(state.sessionProjectMounts[SESSION_ID]?.map((mount) => mount.mountId)).toEqual([
      'mount-api',
    ]);
    expect(state.sessionWorktreeRecords[SESSION_ID]?.map((record) => record.id)).toEqual([
      'mount-api',
    ]);
  });
});
