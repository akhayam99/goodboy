import { describe, expect, it } from 'vitest';
import type { Project, ProjectId } from '@goodboy/types';
import { worktreeStatusTargetsOf } from './targets';

const PROJECTS = [
  { id: 'project-ledger', baseBranch: 'develop' },
  { id: 'project-plain', baseBranch: null },
] as unknown as ReadonlyArray<Project>;

const mount = ({
  projectId,
  worktreePath,
  baseBranch = null,
  isAttached = true,
}: {
  readonly projectId: string;
  readonly worktreePath: string | null;
  readonly baseBranch?: string | null;
  readonly isAttached?: boolean;
}) => ({ projectId: projectId as ProjectId, worktreePath, baseBranch, isAttached });

describe('worktreeStatusTargetsOf', () => {
  it('falls back to the project base when the mount records none', () => {
    expect(
      worktreeStatusTargetsOf({
        mounts: [mount({ projectId: 'project-ledger', worktreePath: '/wt/a' })],
        projects: PROJECTS,
      }),
    ).toEqual([{ worktreePath: '/wt/a', baseBranch: 'develop' }]);
  });

  it('keeps the base recorded on the mount over the project base', () => {
    expect(
      worktreeStatusTargetsOf({
        mounts: [
          mount({ projectId: 'project-ledger', worktreePath: '/wt/a', baseBranch: 'release/9' }),
        ],
        projects: PROJECTS,
      }),
    ).toEqual([{ worktreePath: '/wt/a', baseBranch: 'release/9' }]);
  });

  it('leaves the base out when nobody picked one', () => {
    expect(
      worktreeStatusTargetsOf({
        mounts: [mount({ projectId: 'project-plain', worktreePath: '/wt/b' })],
        projects: PROJECTS,
      }),
    ).toEqual([{ worktreePath: '/wt/b' }]);
  });

  it('skips detached mounts and mounts without a folder', () => {
    expect(
      worktreeStatusTargetsOf({
        mounts: [
          mount({ projectId: 'project-plain', worktreePath: null }),
          mount({ projectId: 'project-plain', worktreePath: '' }),
          mount({ projectId: 'project-plain', worktreePath: '/wt/c', isAttached: false }),
        ],
        projects: PROJECTS,
      }),
    ).toEqual([]);
  });
});
