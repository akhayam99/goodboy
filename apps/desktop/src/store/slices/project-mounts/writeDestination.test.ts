import { describe, expect, it } from 'vitest';
import type { MountId, Project, ProjectId, SessionProjectMount, WorkspaceId } from '@goodboy/types';
import {
  listWriteDestinationCandidates,
  resolveWriteDestination,
  writeDestinationLabel,
  writeDestinationsMatch,
} from './writeDestination';

const PROJECT_ID = 'project-web' as ProjectId;
const FOLDER_PROJECT_ID = 'project-notes' as ProjectId;
const MOUNT_ID = 'mount-web-main' as MountId;

const repoMount: SessionProjectMount = {
  mountId: MOUNT_ID,
  projectId: PROJECT_ID,
  mountName: 'web',
  worktreePath: '/sessions/one/web',
  repoRoot: '/repos/web',
  branch: 'ak/feat-thing',
  isAttached: true,
};

const folderMount: SessionProjectMount = {
  mountId: 'mount-notes' as MountId,
  projectId: FOLDER_PROJECT_ID,
  mountName: 'notes',
  worktreePath: '/sessions/one/notes',
  repoRoot: '/repos/notes',
  branch: '',
  isAttached: true,
};

const WORKSPACE_ID = 'ws-1' as WorkspaceId;

const project = ({
  id,
  name,
  kind,
}: {
  readonly id: ProjectId;
  readonly name: string;
  readonly kind: 'repo' | 'folder';
}): Project =>
  ({
    id,
    workspaceId: WORKSPACE_ID,
    name,
    kind,
    rootPath: `/repos/${name}`,
  }) as Project;

const projects: ReadonlyArray<Project> = [
  project({ id: PROJECT_ID, name: 'web', kind: 'repo' }),
  project({ id: FOLDER_PROJECT_ID, name: 'notes', kind: 'folder' }),
];

describe('resolveWriteDestination', () => {
  it('describes a git mount as project / worktree / branch', () => {
    const destination = resolveWriteDestination({
      mount: repoMount,
      projectName: 'web',
      scratchPath: null,
    });
    expect(destination).toEqual({
      kind: 'mount',
      mountId: MOUNT_ID,
      projectId: PROJECT_ID,
      projectName: 'web',
      mountName: 'web',
      branch: 'ak/feat-thing',
      worktreePath: '/sessions/one/web',
      hasGit: true,
    });
    expect(writeDestinationLabel(destination)).toBe('web / web / ak/feat-thing');
  });

  it('marks a branchless folder mount as no git', () => {
    const destination = resolveWriteDestination({
      mount: folderMount,
      projectName: 'notes',
      scratchPath: null,
    });
    expect(destination.kind === 'mount' && destination.hasGit).toBe(false);
    expect(writeDestinationLabel(destination)).toBe('notes / working folder / no git');
  });

  it('falls back to the session scratch folder when there is no mount', () => {
    const destination = resolveWriteDestination({
      mount: null,
      projectName: null,
      scratchPath: '/goodboy/scratch/session-1',
    });
    expect(destination).toEqual({ kind: 'scratch', path: '/goodboy/scratch/session-1' });
    expect(writeDestinationLabel(destination)).toBe('session scratch folder');
  });
});

describe('writeDestinationsMatch', () => {
  it('matches two scratch destinations regardless of path', () => {
    expect(
      writeDestinationsMatch({ kind: 'scratch', path: '/a' }, { kind: 'scratch', path: '/b' }),
    ).toBe(true);
  });

  it('matches two mount destinations by mount id alone', () => {
    const a = resolveWriteDestination({ mount: repoMount, projectName: 'web', scratchPath: null });
    const b = resolveWriteDestination({
      mount: { ...repoMount, branch: 'ak/other' },
      projectName: 'web',
      scratchPath: null,
    });
    expect(writeDestinationsMatch(a, b)).toBe(true);
  });

  it('never matches a mount against a scratch destination', () => {
    const mount = resolveWriteDestination({
      mount: repoMount,
      projectName: 'web',
      scratchPath: null,
    });
    const scratch = resolveWriteDestination({ mount: null, projectName: null, scratchPath: null });
    expect(writeDestinationsMatch(mount, scratch)).toBe(false);
  });
});

describe('listWriteDestinationCandidates', () => {
  it('lists only attached mounts with a worktree, joined to their project name', () => {
    const detached: SessionProjectMount = {
      ...repoMount,
      mountId: 'mount-detached' as MountId,
      isAttached: false,
    };
    const candidates = listWriteDestinationCandidates({
      mounts: [repoMount, folderMount, detached],
      projects,
    });
    expect(candidates.map((candidate) => candidate.mountId)).toEqual([MOUNT_ID, 'mount-notes']);
    expect(candidates[0]?.projectName).toBe('web');
  });
});
