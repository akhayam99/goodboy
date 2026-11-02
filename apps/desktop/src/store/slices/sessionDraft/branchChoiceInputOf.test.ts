// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { brandId, type ProjectId } from '@goodboy/types';
import { branchChoiceInputOf } from './branchChoiceInputOf';

const PROJECT = brandId<ProjectId>({ value: 'project-ledger-core' });
const OTHER = brandId<ProjectId>({ value: 'project-notify-relay' });

describe('branchChoiceInputOf', () => {
  it('gives the session the picked branch', () => {
    expect(
      branchChoiceInputOf({
        choice: { projectId: PROJECT, goal: 'x', pick: { kind: 'branch', branch: 'ak/one' } },
        projectId: PROJECT,
      }),
    ).toEqual({ existingBranch: 'ak/one' });
  });

  it('gives the session the branch and the worktree that holds it', () => {
    expect(
      branchChoiceInputOf({
        choice: {
          projectId: PROJECT,
          goal: 'x',
          pick: { kind: 'worktree', branch: 'ak/one', worktreePath: '/repos/ledger-core/wt' },
        },
        projectId: PROJECT,
      }),
    ).toEqual({ existingBranch: 'ak/one', existingWorktreePath: '/repos/ledger-core/wt' });
  });

  it('tells the session to ignore the branch the goal names', () => {
    expect(
      branchChoiceInputOf({
        choice: { projectId: PROJECT, goal: 'x', pick: { kind: 'new-branch' } },
        projectId: PROJECT,
      }),
    ).toEqual({ isGoalBranchIgnored: true });
  });

  it('drops a choice made for another project', () => {
    expect(
      branchChoiceInputOf({
        choice: { projectId: OTHER, goal: 'x', pick: { kind: 'branch', branch: 'ak/one' } },
        projectId: PROJECT,
      }),
    ).toEqual({});
  });

  it('gives nothing without a choice', () => {
    expect(branchChoiceInputOf({ choice: null, projectId: PROJECT })).toEqual({});
  });
});
