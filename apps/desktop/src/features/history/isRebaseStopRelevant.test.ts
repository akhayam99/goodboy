import { describe, expect, it } from 'vitest';
import type { WorktreeStatus } from '@goodboy/types';
import type { HistoryStopReason } from '../../store/slices/history/types';
import { worktreeStatusOf } from '../../test/worktreeStatusOf';
import { isRebaseStopRelevant } from './isRebaseStopRelevant';

const STOP_HEAD = 'a1b2c3d4e5f60718293a4b5c6d7e8f9012345678';
const NEW_HEAD = 'f0e1d2c3b4a5968778695a4b3c2d1e0f98765432';

type StatusParams = {
  readonly head?: string;
  readonly ahead?: number;
  readonly behind?: number;
  readonly changed?: number;
  readonly inProgress?: WorktreeStatus['inProgress'];
  readonly hasUpstream?: boolean;
};

const statusOf = ({
  head = STOP_HEAD,
  ahead = 0,
  behind = 0,
  changed = 0,
  inProgress = null,
  hasUpstream = true,
}: StatusParams): WorktreeStatus => {
  const base = worktreeStatusOf({ ahead, behind, inProgress });
  return {
    ...base,
    head,
    upstream: hasUpstream ? base.upstream : null,
    workingTree: {
      kind: 'known',
      staged: changed,
      unstaged: 0,
      untracked: 0,
      unmerged: 0,
      changed,
    },
  };
};

type CaseParams = {
  readonly reason: HistoryStopReason;
  readonly status: WorktreeStatus | null;
};

const relevant = ({ reason, status }: CaseParams): boolean =>
  isRebaseStopRelevant({ reason, head: STOP_HEAD, status });

describe('a stopped rebase card is relevant only while its cause is still there', () => {
  it('keeps every card while git has not been read', () => {
    expect(relevant({ reason: 'origin-moved', status: null })).toBe(true);
    expect(relevant({ reason: 'dirty', status: null })).toBe(true);
  });

  it.each(['origin-moved', 'push-failed'] satisfies ReadonlyArray<HistoryStopReason>)(
    'keeps %s while the branch has commits origin does not have',
    (reason) => {
      expect(relevant({ reason, status: statusOf({ ahead: 3 }) })).toBe(true);
    },
  );

  it.each(['origin-moved', 'push-failed'] satisfies ReadonlyArray<HistoryStopReason>)(
    'settles %s once origin has every local commit',
    (reason) => {
      expect(relevant({ reason, status: statusOf({ ahead: 0 }) })).toBe(false);
    },
  );

  it('keeps origin-moved while a rebase or merge is still in progress', () => {
    expect(
      relevant({ reason: 'origin-moved', status: statusOf({ ahead: 0, inProgress: 'rebase' }) }),
    ).toBe(true);
    expect(
      relevant({ reason: 'origin-moved', status: statusOf({ ahead: 0, inProgress: 'merge' }) }),
    ).toBe(true);
  });

  it('keeps a failed push on a branch with no upstream', () => {
    expect(relevant({ reason: 'push-failed', status: statusOf({ hasUpstream: false }) })).toBe(
      true,
    );
  });

  it('keeps dirty while files are still changed at the same head', () => {
    expect(relevant({ reason: 'dirty', status: statusOf({ changed: 4 }) })).toBe(true);
  });

  it('settles dirty once the tree is clean or the head moved', () => {
    expect(relevant({ reason: 'dirty', status: statusOf({ changed: 0 }) })).toBe(false);
    expect(relevant({ reason: 'dirty', status: statusOf({ changed: 4, head: NEW_HEAD }) })).toBe(
      false,
    );
  });

  it('keeps head-moved while the branch is still behind its base', () => {
    expect(relevant({ reason: 'head-moved', status: statusOf({ behind: 3 }) })).toBe(true);
  });

  it('settles head-moved once the branch moved and caught up with its base', () => {
    expect(relevant({ reason: 'head-moved', status: statusOf({ head: NEW_HEAD }) })).toBe(false);
  });

  it('keeps a conflict while the worktree still sits where it stopped', () => {
    expect(relevant({ reason: 'conflict', status: statusOf({ behind: 0 }) })).toBe(true);
    expect(relevant({ reason: 'conflict', status: statusOf({ head: NEW_HEAD, behind: 2 }) })).toBe(
      true,
    );
  });

  it('settles a conflict once the branch was rebased elsewhere', () => {
    expect(relevant({ reason: 'conflict', status: statusOf({ head: NEW_HEAD }) })).toBe(false);
  });
});
