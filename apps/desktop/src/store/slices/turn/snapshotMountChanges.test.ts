import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { MountId, Project, ProjectId, SessionId, SessionProjectMount } from '@goodboy/types';

const { changedFiles } = vi.hoisted(() => ({ changedFiles: vi.fn() }));

vi.mock('../../../features/worktree/worktree', () => ({
  worktreeChangedFiles: changedFiles,
}));

import { snapshotMountChanges } from './snapshotMountChanges';

const mount = (mountId: string, projectId: string, baseBranch: string | null) =>
  ({
    mountId: mountId as MountId,
    sessionId: 'session-snapshot' as SessionId,
    projectId: projectId as ProjectId,
    worktreePath: `/repo/${mountId}`,
    baseBranch,
  }) as SessionProjectMount;

const PROJECTS = [
  { id: 'project-web', baseBranch: 'develop' },
  { id: 'project-api', baseBranch: null },
] as unknown as ReadonlyArray<Project>;

beforeEach(() => {
  changedFiles.mockReset();
  changedFiles.mockResolvedValue({ paths: [], additions: 0, deletions: 0, numstat: '1\t0\ta.ts' });
});

describe('snapshotMountChanges', () => {
  it('measures each mount against the base its user picked', async () => {
    const snapshot = await snapshotMountChanges({
      mounts: [
        mount('mount-web', 'project-web', null),
        mount('mount-pinned', 'project-web', 'release/9'),
        mount('mount-api', 'project-api', null),
      ],
      projects: PROJECTS,
    });

    expect(changedFiles).toHaveBeenCalledWith({
      worktreePath: '/repo/mount-web',
      baseBranch: 'develop',
    });
    expect(changedFiles).toHaveBeenCalledWith({
      worktreePath: '/repo/mount-pinned',
      baseBranch: 'release/9',
    });
    expect(changedFiles).toHaveBeenCalledWith({
      worktreePath: '/repo/mount-api',
      baseBranch: null,
    });
    expect(snapshot.get('mount-web' as MountId)).toBe('1\t0\ta.ts');
  });

  it('leaves out a mount whose worktree cannot be read', async () => {
    changedFiles.mockRejectedValueOnce(new Error('gone'));

    const snapshot = await snapshotMountChanges({
      mounts: [mount('mount-web', 'project-web', null)],
      projects: PROJECTS,
    });

    expect(snapshot.size).toBe(0);
  });
});
