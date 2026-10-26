// @vitest-environment node
import { describe, expect, it } from 'vitest';
import type { WorktreeStatus } from '@goodboy/types';
import {
  branchPresenceOf,
  branchPriorityOf,
  isBranchMergedOf,
  mainPresenceOf,
} from './branchPresence';

const statusOf = (overrides: Partial<WorktreeStatus> = {}): WorktreeStatus => ({
  branch: 'feature/x',
  head: 'abc123',
  headSubject: 'base',
  upstreamDistance: { kind: 'known', ahead: 0, behind: 0 },
  mainDistance: { kind: 'known', ahead: 0, behind: 0 },
  workingTree: { kind: 'known', staged: 0, unstaged: 0, untracked: 0, unmerged: 0, changed: 0 },
  upstream: 'origin/feature/x',
  inProgress: null,
  ...overrides,
});

describe('branchPresenceOf', () => {
  it('reports a merged branch regardless of its upstream', () => {
    expect(branchPresenceOf({ status: statusOf(), isMerged: true })).toEqual({
      kind: 'merged',
      label: 'Merged',
      toPush: null,
    });
  });

  it('says merged, then the commits after the merge', () => {
    expect(branchPresenceOf({ status: statusOf(), isMerged: false, commitsAfterMerge: 1 })).toEqual(
      { kind: 'merged-then', label: 'Merged, then 1 new commit', toPush: null },
    );
  });

  it('reports a branch never pushed as local only', () => {
    const status = statusOf({
      upstream: null,
      upstreamDistance: { kind: 'unknown', reason: 'no-upstream' },
    });

    expect(branchPresenceOf({ status, isMerged: false })).toEqual({
      kind: 'local-only',
      label: 'Local only',
      toPush: null,
    });
  });

  it('reports a force-pushed remote as diverged, with nothing to push', () => {
    const status = statusOf({ upstreamDistance: { kind: 'known', ahead: 2, behind: 3 } });

    expect(branchPresenceOf({ status, isMerged: false })).toEqual({
      kind: 'diverged',
      label: 'Diverged from origin',
      toPush: null,
    });
  });

  it('reports a pruned upstream as gone on origin', () => {
    const status = statusOf({
      upstreamDistance: { kind: 'unknown', reason: 'upstream-gone' },
    });

    expect(branchPresenceOf({ status, isMerged: false })).toEqual({
      kind: 'gone-on-origin',
      label: 'Gone on origin',
      toPush: null,
    });
  });

  it('reports on origin with a to-push count when ahead', () => {
    const status = statusOf({ upstreamDistance: { kind: 'known', ahead: 2, behind: 0 } });

    expect(branchPresenceOf({ status, isMerged: false })).toEqual({
      kind: 'on-origin',
      label: 'On origin',
      toPush: 2,
    });
  });

  it('reports on origin with no to-push count when nothing is unpushed', () => {
    expect(branchPresenceOf({ status: statusOf(), isMerged: false })).toEqual({
      kind: 'on-origin',
      label: 'On origin',
      toPush: null,
    });
  });
});

describe('branchPresenceOf with an open pull request', () => {
  const onBase = statusOf({ head: 'aaaaaaa1' });

  it('says the worktree is not on the pull request commits when it sits on the base', () => {
    expect(
      branchPresenceOf({
        status: onBase,
        isMerged: false,
        openRequest: { headSha: 'bbbbbbb2' },
      }),
    ).toEqual({ kind: 'not-on-pr', label: "Not on the PR's commits", toPush: null });
  });

  it('reads as normal when HEAD is the pull request head, short or full sha', () => {
    const full = 'aaaaaaa1ffffffffffffffffffffffffffffffff';

    expect(
      branchPresenceOf({ status: onBase, isMerged: false, openRequest: { headSha: full } }).kind,
    ).toBe('on-origin');
  });

  it('reads as normal when the worktree has commits of its own', () => {
    const status = statusOf({
      head: 'ccccccc3',
      mainDistance: { kind: 'known', ahead: 2, behind: 0 },
    });

    expect(
      branchPresenceOf({ status, isMerged: false, openRequest: { headSha: 'bbbbbbb2' } }).kind,
    ).toBe('on-origin');
  });

  it('reads as normal when the pull request head is not known', () => {
    expect(
      branchPresenceOf({ status: onBase, isMerged: false, openRequest: { headSha: null } }).kind,
    ).toBe('on-origin');
  });

  it('leads the priority word', () => {
    const presence = branchPresenceOf({
      status: onBase,
      isMerged: false,
      openRequest: { headSha: 'bbbbbbb2' },
    });
    const main = mainPresenceOf({ status: onBase, isRebasingAgent: false });

    expect(branchPriorityOf({ presence, main }).word).toBe("Not on the PR's commits");
  });
});

describe('mainPresenceOf', () => {
  it('reports rebasing on main when an agent is on it, even if git has no rebase folders', () => {
    expect(mainPresenceOf({ status: statusOf(), isRebasingAgent: true })).toEqual({
      kind: 'rebasing-on-main',
      label: 'Rebasing on main',
      behind: null,
    });
  });

  it('reports a stopped rebase when git has one and no agent is on it', () => {
    const status = statusOf({ inProgress: 'rebase' });

    expect(mainPresenceOf({ status, isRebasingAgent: false })).toEqual({
      kind: 'rebase-stopped',
      label: 'Rebase stopped',
      behind: null,
    });
  });

  it('prefers the agent-running state over a leftover git rebase folder', () => {
    const status = statusOf({ inProgress: 'rebase' });

    expect(mainPresenceOf({ status, isRebasingAgent: true }).kind).toBe('rebasing-on-main');
  });

  it('reports behind main by N', () => {
    const status = statusOf({ mainDistance: { kind: 'known', ahead: 0, behind: 3 } });

    expect(mainPresenceOf({ status, isRebasingAgent: false })).toEqual({
      kind: 'behind-main',
      label: 'Behind main by 3',
      behind: 3,
    });
  });

  it('reports up to date otherwise', () => {
    expect(mainPresenceOf({ status: statusOf(), isRebasingAgent: false })).toEqual({
      kind: 'up-to-date',
      label: 'Up to date',
      behind: 0,
    });
  });
});

describe('branchPriorityOf', () => {
  it('orders a stopped rebase above everything, merged and on origin included', () => {
    const status = statusOf({ inProgress: 'rebase' });
    const main = mainPresenceOf({ status, isRebasingAgent: false });

    expect(
      branchPriorityOf({ presence: branchPresenceOf({ status, isMerged: true }), main }),
    ).toEqual({ kind: 'rebase-stopped', word: 'Rebase stopped' });
    expect(
      branchPriorityOf({ presence: branchPresenceOf({ status, isMerged: false }), main }).word,
    ).toBe('Rebase stopped');
  });

  it('says the branch is rebasing while the rewriter works on it', () => {
    const status = statusOf({ mainDistance: { kind: 'known', ahead: 0, behind: 3 } });
    const presence = branchPresenceOf({ status, isMerged: false });
    const main = mainPresenceOf({ status, isRebasingAgent: true });

    expect(branchPriorityOf({ presence, main }).word).toBe('Rebasing on main');
  });

  it('orders merged above everything else', () => {
    const presence = branchPresenceOf({ status: statusOf(), isMerged: true });
    const main = mainPresenceOf({ status: statusOf(), isRebasingAgent: false });

    expect(branchPriorityOf({ presence, main }).word).toBe('Merged');
  });

  it('orders gone on origin above local only and behind main', () => {
    const status = statusOf({ upstreamDistance: { kind: 'unknown', reason: 'upstream-gone' } });
    const presence = branchPresenceOf({ status, isMerged: false });
    const main = mainPresenceOf({ status, isRebasingAgent: false });

    expect(branchPriorityOf({ presence, main }).word).toBe('Gone on origin');
  });

  it('orders local only above behind main by N', () => {
    const status = statusOf({
      upstream: null,
      upstreamDistance: { kind: 'unknown', reason: 'no-upstream' },
      mainDistance: { kind: 'known', ahead: 0, behind: 4 },
    });
    const presence = branchPresenceOf({ status, isMerged: false });
    const main = mainPresenceOf({ status, isRebasingAgent: false });

    expect(branchPriorityOf({ presence, main }).word).toBe('Local only');
  });

  it('falls back to behind main by N, then on origin', () => {
    const behind = statusOf({ mainDistance: { kind: 'known', ahead: 0, behind: 5 } });
    const presenceBehind = branchPresenceOf({ status: behind, isMerged: false });
    const mainBehind = mainPresenceOf({ status: behind, isRebasingAgent: false });
    expect(branchPriorityOf({ presence: presenceBehind, main: mainBehind }).word).toBe(
      'Behind main by 5',
    );

    const upToDate = statusOf();
    const presenceUpToDate = branchPresenceOf({ status: upToDate, isMerged: false });
    const mainUpToDate = mainPresenceOf({ status: upToDate, isRebasingAgent: false });
    expect(branchPriorityOf({ presence: presenceUpToDate, main: mainUpToDate }).word).toBe(
      'On origin',
    );
  });
});

describe('isBranchMergedOf', () => {
  const merged = (overrides: Partial<WorktreeStatus>, isMainCheckout = false) =>
    isBranchMergedOf({
      status: statusOf(overrides),
      baseBranch: 'main',
      isMainCheckout,
      isRequestMerged: false,
    });

  it('trusts a merged pull request whatever git says', () => {
    expect(
      isBranchMergedOf({
        status: null,
        baseBranch: 'main',
        isMainCheckout: false,
        isRequestMerged: true,
      }),
    ).toBe(true);
  });

  it('keeps a merged branch open once it moved past the merged head', () => {
    expect(
      isBranchMergedOf({
        status: statusOf(),
        baseBranch: 'main',
        isMainCheckout: false,
        isRequestMerged: true,
        commitsAfterMerge: 2,
      }),
    ).toBe(false);
  });

  it('never infers merged from ancestry while the mount links an open pull request', () => {
    const status = statusOf({ mainDistance: { kind: 'known', ahead: 0, behind: 2 } });
    const withRequest = (hasOpenRequest: boolean) =>
      isBranchMergedOf({
        status,
        baseBranch: 'main',
        isMainCheckout: false,
        isRequestMerged: false,
        hasOpenRequest,
      });

    expect(withRequest(false)).toBe(true);
    expect(withRequest(true)).toBe(false);
  });

  it('still trusts the request itself when it merged', () => {
    expect(
      isBranchMergedOf({
        status: statusOf(),
        baseBranch: 'main',
        isMainCheckout: false,
        isRequestMerged: true,
        hasOpenRequest: true,
      }),
    ).toBe(true);
  });

  it('calls a pushed branch with nothing past the base merged', () => {
    expect(merged({ mainDistance: { kind: 'known', ahead: 0, behind: 3 } })).toBe(true);
  });

  it('keeps a branch with commits past the base open', () => {
    expect(merged({ mainDistance: { kind: 'known', ahead: 1, behind: 0 } })).toBe(false);
  });

  it('keeps a fresh worktree that still tracks the base open', () => {
    expect(merged({ upstream: 'origin/main' })).toBe(false);
  });

  it('keeps a branch never pushed open', () => {
    expect(merged({ upstream: null })).toBe(false);
  });

  it('keeps a branch with uncommitted files open', () => {
    expect(
      merged({
        workingTree: {
          kind: 'known',
          staged: 0,
          unstaged: 1,
          untracked: 0,
          unmerged: 0,
          changed: 1,
        },
      }),
    ).toBe(false);
  });

  it('never calls the main checkout or the base branch merged', () => {
    expect(merged({}, true)).toBe(false);
    expect(merged({ branch: 'main', upstream: 'origin/main' })).toBe(false);
  });
});
