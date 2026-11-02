// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { draftBranchFactsOf } from './draftBranchFactsOf';

const BRANCHES = ['main', 'ak/ledger-export', 'ak/notify-retries'];

describe('draftBranchFactsOf', () => {
  it('adopts the one branch the goal names', () => {
    expect(
      draftBranchFactsOf({
        goal: 'continue on ak/ledger-export',
        branches: BRANCHES,
        baseBranch: 'main',
        choice: null,
      }),
    ).toEqual({
      branch: 'ak/ledger-export',
      isExistingBranch: true,
      isNamedByGoal: true,
      goalBranches: [],
    });
  });

  it('lists the branches when the goal names several', () => {
    expect(
      draftBranchFactsOf({
        goal: 'compare ak/ledger-export with ak/notify-retries',
        branches: BRANCHES,
        baseBranch: 'main',
        choice: null,
      }),
    ).toEqual({
      branch: null,
      isExistingBranch: false,
      isNamedByGoal: false,
      goalBranches: ['ak/ledger-export', 'ak/notify-retries'],
    });
  });

  it('says nothing when the goal names no branch', () => {
    expect(
      draftBranchFactsOf({
        goal: 'speed up the export',
        branches: BRANCHES,
        baseBranch: 'main',
        choice: null,
      }),
    ).toBeNull();
  });

  it('reads the picked branch as the existing one', () => {
    expect(
      draftBranchFactsOf({
        goal: 'compare ak/ledger-export with ak/notify-retries',
        branches: BRANCHES,
        baseBranch: 'main',
        choice: { kind: 'branch', branch: 'ak/notify-retries' },
      }),
    ).toMatchObject({ branch: 'ak/notify-retries', isExistingBranch: true, goalBranches: [] });
  });

  it('says nothing once the owner chose a new branch', () => {
    expect(
      draftBranchFactsOf({
        goal: 'continue on ak/ledger-export',
        branches: BRANCHES,
        baseBranch: 'main',
        choice: { kind: 'new-branch' },
      }),
    ).toBeNull();
  });
});
