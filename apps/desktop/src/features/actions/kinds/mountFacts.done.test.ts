// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { brandId, type MountId, type ProjectId, type SessionId } from '@goodboy/types';
import { worktreeStatusOf } from '../../../test/worktreeStatusOf';
import { mountFacts } from './mountFacts';

type Params = {
  readonly state: string;
};

const factsFor = ({ state }: Params) =>
  mountFacts({
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
    isAttached: true,
    isBranchGone: false,
    canRestoreBranch: false,
    request: {
      state,
      isDraft: false,
      label: 'PR #318',
      number: 318,
      provider: 'github',
      mergedHeadSha: 'sha-merged',
    },
    status: worktreeStatusOf({ behind: 63, unmerged: 2, inProgress: 'rebase' }),
    remoteKind: 'github',
    comments: 0,
    canStartTurnsHere: false,
    isScribeWriting: false,
    blockers: [],
    pinnedRunIds: [],
    pinnedRunLabel: null,
    editors: [],
    onlyOnline: null,
    rebaseConflict: { isWithAuto: false, count: 2 },
    autoBlockedReason: null,
  });

describe('mountFacts on a done branch', () => {
  it.each(['merged', 'closed'])('drops behind, rebase and rebase conflict once %s', (state) => {
    const facts = factsFor({ state });

    expect(facts.behind).toBe(0);
    expect(facts.isRebasing).toBe(false);
    expect(facts.rebaseConflict).toBeNull();
  });

  it('keeps them on an open branch', () => {
    const facts = factsFor({ state: 'open' });

    expect(facts.behind).toBe(63);
    expect(facts.isRebasing).toBe(true);
    expect(facts.rebaseConflict).toEqual({ isWithAuto: false, count: 2 });
  });

  it('carries the merged head the clean up checks against', () => {
    expect(factsFor({ state: 'merged' }).mergedHeadSha).toBe('sha-merged');
  });
});
