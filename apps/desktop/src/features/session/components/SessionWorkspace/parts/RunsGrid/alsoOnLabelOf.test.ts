// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { aProject, nextSessionId } from '@goodboy/types/testing';
import { aMountView } from '../../../../testing/aMountView';
import type { WorkBranch } from '../../../../workBranchesOf';
import { alsoOnLabelOf } from './alsoOnLabelOf';
import { branchListLabelOf } from './branchListLabelOf';

const PROJECT = aProject({ name: 'notify-relay' });

const branchOf = (name: string): WorkBranch => {
  const view = aMountView({
    key: name,
    sessionId: nextSessionId(),
    projectId: PROJECT.id,
    projectName: 'notify-relay',
    branch: name,
  });
  return {
    mountId: view.id,
    projectId: PROJECT.id,
    projectName: 'notify-relay',
    branch: name,
    worktreePath: view.worktreePath,
  };
};

describe('alsoOnLabelOf', () => {
  it('names the branch when the run is on one more', () => {
    expect(alsoOnLabelOf({ branches: [branchOf('feat/retry-budget')] })).toBe(
      'Also on feat/retry-budget',
    );
  });

  it('counts the branches when the run is on two or more', () => {
    expect(alsoOnLabelOf({ branches: [branchOf('feat/a'), branchOf('feat/b')] })).toBe(
      'Also on 2 branches',
    );
  });
});

describe('branchListLabelOf', () => {
  it('lists the project and the branch of each', () => {
    expect(branchListLabelOf({ branches: [branchOf('feat/a'), branchOf('feat/b')] })).toBe(
      'notify-relay · feat/a, notify-relay · feat/b',
    );
  });
});
