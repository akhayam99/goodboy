// @vitest-environment node
import { describe, expect, it } from 'vitest';
import type { IsoDateTime, MountId, ProjectId, SessionId, SessionMountView } from '@goodboy/types';
import { useAppStore } from '../../store';
import { applyMountViews } from './mountViews';

const SESSION_ID = 'session-views' as SessionId;
const NOW = '2026-01-01T00:00:00.000Z' as IsoDateTime;

const viewOf = ({
  id,
  projectId,
  isAttached,
}: {
  readonly id: string;
  readonly projectId: string;
  readonly isAttached: boolean;
}): SessionMountView => ({
  id: id as MountId,
  sessionId: SESSION_ID,
  projectId: projectId as ProjectId,
  mountName: id,
  repoRoot: `/repos/${id}`,
  branch: 'ak/feat',
  baseBranch: null,
  worktreePath: `/container/${id}`,
  lastWorktreePath: `/container/${id}`,
  parallelIndex: 0,
  repoSlug: null,
  isAttached,
  diskState: 'present',
  revision: 1,
  createdAt: NOW,
  updatedAt: NOW,
});

describe('applyMountViews', () => {
  it('keeps a detached mount out of the session worktree records and the project mounts', () => {
    useAppStore.setState(useAppStore.getInitialState(), true);

    applyMountViews({
      set: useAppStore.setState,
      sessionId: SESSION_ID,
      views: [
        viewOf({ id: 'mount-api', projectId: 'project-api', isAttached: true }),
        viewOf({ id: 'mount-web', projectId: 'project-web', isAttached: false }),
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
