import { describe, expect, it } from 'vitest';
import { branchHomeOf } from './branchHomeOf';
import type { OwnedMount } from './ownedMountsOf';

const CREDIT: OwnedMount = {
  mountId: 'm-credit',
  sessionId: 's-northwind',
  workspaceId: 'w-northwind',
  projectId: 'payments-api',
  worktreePath: '/mock/worktrees/northwind/payments-api',
  branch: 'nw/credit',
  isLive: true,
};

const SWITCHED: OwnedMount = { ...CREDIT, branch: 'nw/rounding' };

const SECOND: OwnedMount = {
  ...CREDIT,
  mountId: 'm-credit-2',
  worktreePath: '/mock/worktrees/northwind/payments-api-2',
};

describe('branchHomeOf', () => {
  it('opens the recorded mount while it still shows the branch', () => {
    expect(branchHomeOf({ mounts: [CREDIT], mountId: 'm-credit', branch: 'nw/credit' })).toBe(
      CREDIT.worktreePath,
    );
  });

  it('opens the mount that shows the branch after the recorded one switched', () => {
    expect(
      branchHomeOf({ mounts: [SWITCHED, SECOND], mountId: 'm-credit', branch: 'nw/credit' }),
    ).toBe(SECOND.worktreePath);
  });

  it('never opens a removed worktree, even the recorded one', () => {
    const removed: OwnedMount = { ...CREDIT, isLive: false };
    expect(branchHomeOf({ mounts: [removed], mountId: 'm-credit', branch: 'nw/credit' })).toBe(
      null,
    );
    expect(
      branchHomeOf({
        mounts: [removed, { ...SECOND, isLive: false }],
        mountId: 'm-credit',
        branch: 'nw/credit',
      }),
    ).toBe(null);
    expect(
      branchHomeOf({ mounts: [removed, SECOND], mountId: 'm-credit', branch: 'nw/credit' }),
    ).toBe(SECOND.worktreePath);
  });

  it('has no place when no mount shows the branch any more', () => {
    expect(branchHomeOf({ mounts: [SWITCHED], mountId: 'm-credit', branch: 'nw/credit' })).toBe(
      null,
    );
    expect(
      branchHomeOf({
        mounts: [SWITCHED, { ...SECOND, sessionId: 's-acme' }],
        mountId: 'm-credit',
        branch: 'nw/credit',
      }),
    ).toBe(null);
    expect(branchHomeOf({ mounts: [], mountId: 'm-credit', branch: 'nw/credit' })).toBe(null);
  });
});
