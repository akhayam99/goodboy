// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { brandId, type MountId, type ProjectId, type SessionId } from '@goodboy/types';
import { resolveActions } from '../resolveActions';
import { DIFF_KIND, type DiffFacts } from './diff';
import { MOUNT_KIND } from './mount';
import type { MountFacts } from './mountFacts';

const mountFacts = (overrides: Partial<MountFacts>): MountFacts => ({
  sessionId: brandId<SessionId>({ value: 'session-harborline' }),
  mountId: brandId<MountId>({ value: 'mount-payments' }),
  projectId: brandId<ProjectId>({ value: 'project-payments' }),
  label: 'hl/fix-duplicate-credit',
  branch: 'hl/fix-duplicate-credit',
  baseBranch: 'main',
  mountBaseBranch: null,
  worktreePath: '/work/payments-api',
  keptPath: '/work/payments-api',
  isRepo: true,
  isClosed: false,
  isBranchGone: false,
  canRestoreBranch: false,
  pr: 'open',
  requestLabel: 'PR #318',
  requestNumber: 318,
  requestProvider: 'github',
  createProvider: 'github',
  ahead: 5,
  unpushed: 2,
  behind: 0,
  dirty: 0,
  isDiverged: false,
  onlyOnline: null,
  isRebasing: false,
  rebaseConflict: null,
  autoBlockedReason: null,
  comments: 0,
  canStartTurnsHere: false,
  isScribeWriting: false,
  blockers: [],
  pinnedRunIds: [],
  pinnedRunLabel: null,
  editors: [],
  ...overrides,
});

const diffFacts = (overrides: Partial<MountFacts>): DiffFacts => ({
  ...mountFacts(overrides),
  patch: '',
  rebaseConflicts: 0,
});

type PushParams = {
  readonly overrides: Partial<MountFacts>;
};

const mountPush = ({ overrides }: PushParams) =>
  resolveActions({ definitions: MOUNT_KIND.actions, facts: mountFacts(overrides) }).find(
    (action) => action.id === 'mount.push',
  );

const diffPush = ({ overrides }: PushParams) =>
  resolveActions({ definitions: DIFF_KIND.actions, facts: diffFacts(overrides) }).find(
    (action) => action.id === 'diff.push',
  );

describe('the one push action behind mount.push and diff.push', () => {
  it('says the same words for the same branch', () => {
    const overrides = { unpushed: 2 };

    expect(mountPush({ overrides })?.label).toBe('Push 2 commits');
    expect(diffPush({ overrides })?.label).toBe('Push 2 commits');
  });

  it('says Force push for a diverged branch in both, with the same confirm', () => {
    const overrides = { ahead: 2, unpushed: 2, isDiverged: true, onlyOnline: [] };

    expect(mountPush({ overrides })?.label).toBe('Force push 2 commits');
    expect(diffPush({ overrides })?.label).toBe('Force push 2 commits');
    expect(mountPush({ overrides })?.confirm?.title).toBe(diffPush({ overrides })?.confirm?.title);
  });

  it('is offered for a branch with no pull request in both', () => {
    const overrides = { pr: null, unpushed: 3 };

    expect(mountPush({ overrides })?.slot).toBe('menu');
    expect(diffPush({ overrides })?.slot).toBe('menu');
  });

  it.each([
    { name: 'nothing to push', overrides: { unpushed: 0 } },
    { name: 'a merged pull request', overrides: { pr: 'merged' as const } },
    { name: 'a rebase in progress', overrides: { isRebasing: true } },
    { name: 'a closed worktree', overrides: { isClosed: true, worktreePath: null } },
  ])('is offered in neither for $name', ({ overrides }) => {
    expect(mountPush({ overrides })).toBeUndefined();
    expect(diffPush({ overrides })).toBeUndefined();
  });
});
