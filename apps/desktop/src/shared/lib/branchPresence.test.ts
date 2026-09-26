import { describe, expect, it } from 'vitest';
import type { WorktreeStatus } from '@goodboy/types';
import { branchPresenceOf, branchPriorityWordOf, mainPresenceOf } from './branchPresence';

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

describe('branchPriorityWordOf', () => {
  it('orders merged above everything else', () => {
    const presence = branchPresenceOf({ status: statusOf(), isMerged: true });
    const main = mainPresenceOf({ status: statusOf(), isRebasingAgent: false });

    expect(branchPriorityWordOf({ presence, main })).toBe('Merged');
  });

  it('orders gone on origin above local only and behind main', () => {
    const status = statusOf({ upstreamDistance: { kind: 'unknown', reason: 'upstream-gone' } });
    const presence = branchPresenceOf({ status, isMerged: false });
    const main = mainPresenceOf({ status, isRebasingAgent: false });

    expect(branchPriorityWordOf({ presence, main })).toBe('Gone on origin');
  });

  it('orders local only above behind main by N', () => {
    const status = statusOf({
      upstream: null,
      upstreamDistance: { kind: 'unknown', reason: 'no-upstream' },
      mainDistance: { kind: 'known', ahead: 0, behind: 4 },
    });
    const presence = branchPresenceOf({ status, isMerged: false });
    const main = mainPresenceOf({ status, isRebasingAgent: false });

    expect(branchPriorityWordOf({ presence, main })).toBe('Local only');
  });

  it('falls back to behind main by N, then on origin', () => {
    const behind = statusOf({ mainDistance: { kind: 'known', ahead: 0, behind: 5 } });
    const presenceBehind = branchPresenceOf({ status: behind, isMerged: false });
    const mainBehind = mainPresenceOf({ status: behind, isRebasingAgent: false });
    expect(branchPriorityWordOf({ presence: presenceBehind, main: mainBehind })).toBe(
      'Behind main by 5',
    );

    const upToDate = statusOf();
    const presenceUpToDate = branchPresenceOf({ status: upToDate, isMerged: false });
    const mainUpToDate = mainPresenceOf({ status: upToDate, isRebasingAgent: false });
    expect(branchPriorityWordOf({ presence: presenceUpToDate, main: mainUpToDate })).toBe(
      'On origin',
    );
  });
});
