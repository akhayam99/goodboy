// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { IsoDateTime, MountId, ProjectId, SessionId, SessionMountView } from '@goodboy/types';

vi.mock('../../../shared/lib/db', () => ({ tauriDatabase: {} }));

import { useAppStore } from '../../store';
import { applyMountViews } from './mountViews';

const SESSION_ID = 'session-views' as SessionId;
const STAMP = '2026-01-01T00:00:00.000Z' as IsoDateTime;

const viewOf = (overrides: Partial<SessionMountView>): SessionMountView => ({
  id: 'mount-api' as MountId,
  sessionId: SESSION_ID,
  projectId: 'project-api' as ProjectId,
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
  createdAt: STAMP,
  updatedAt: STAMP,
  repoSlug: null,
  ...overrides,
});

beforeEach(() => {
  useAppStore.setState({
    sessions: [],
    sessionActiveMount: {},
    sessionBranches: {},
    sessionMounts: {},
    sessionWorktreeRecords: {},
    sessionProjectMounts: {},
    sessionWorktrees: {},
  });
});

describe('applyMountViews', () => {
  it('keeps a detached mount out of the session worktree records and the project mounts', () => {
    applyMountViews({
      set: useAppStore.setState,
      sessionId: SESSION_ID,
      views: [
        viewOf({}),
        viewOf({
          id: 'mount-web' as MountId,
          projectId: 'project-web' as ProjectId,
          isAttached: false,
        }),
      ],
    });

    const state = useAppStore.getState();
    expect(state.sessionProjectMounts[SESSION_ID]?.map((mount) => mount.mountId)).toEqual([
      'mount-api',
    ]);
    expect(state.sessionWorktreeRecords?.[SESSION_ID]?.map((record) => record.id)).toEqual([
      'mount-api',
    ]);
  });
});
