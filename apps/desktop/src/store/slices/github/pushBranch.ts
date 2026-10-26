import type { MountId, SessionId } from '@goodboy/types';
import { formatError } from '@goodboy/ui';
import { ONLINE_COPY_CHANGED_MESSAGE } from '../../../features/history/onlineCopyChangedMessage';
import { ORIGIN_MOVED_MESSAGE } from '../../../features/history/originMovedMessage';
import type { SliceDeps } from '../../slice-types';
import { settleHistoryPush } from '../history/settleHistoryPush';
import type { BranchPushResult } from './branchPushResult';
import { forcePushSessionBranch } from './forcePushSessionBranch';
import { pushExpectedLease } from './pushExpectedLease';
import { pushSessionBranch } from './pushSessionBranch';

type PlainGuard = {
  readonly mode: 'plain';
  readonly expectedWorktreePath?: string;
  readonly expectedBranch?: string;
  readonly sha?: string;
};

type LeaseGuard =
  | {
      readonly kind: 'confirmed';
      readonly confirmedOnlyOnline: ReadonlyArray<string> | null;
      readonly confirmedRemoteSha: string | null;
    }
  | {
      readonly kind: 'expected';
      readonly expectedRemoteSha: string | null;
      readonly sha?: string;
      readonly worktreePath?: string;
      readonly branch?: string;
    };

type LeaseMode = {
  readonly mode: 'lease';
  readonly guard: LeaseGuard;
};

export type BranchPushParams = {
  readonly sessionId: SessionId;
  readonly mountId: MountId;
} & (PlainGuard | LeaseMode);

type FailureParams = {
  readonly error: string;
};

const MOVED_MESSAGES: ReadonlySet<string> = new Set([
  ORIGIN_MOVED_MESSAGE,
  ONLINE_COPY_CHANGED_MESSAGE,
]);

const failureOf = ({ error }: FailureParams): BranchPushResult => ({
  ok: false,
  error,
  reason: MOVED_MESSAGES.has(error) ? 'moved' : 'failed',
});

type RunParams = {
  readonly sessionId: SessionId;
  readonly mountId: MountId;
  readonly push: PlainGuard | LeaseMode;
};

export const pushBranch = ({ set, get }: SliceDeps) => {
  const run = async ({ sessionId, mountId, push }: RunParams): Promise<BranchPushResult> => {
    if (push.mode === 'plain') {
      const result = await pushSessionBranch({
        get,
        sessionId,
        mountId,
        ...(push.expectedWorktreePath !== undefined && {
          expectedWorktreePath: push.expectedWorktreePath,
        }),
        ...(push.expectedBranch !== undefined && { expectedBranch: push.expectedBranch }),
        ...(push.sha !== undefined && { sha: push.sha }),
      });
      return result.ok ? result : failureOf({ error: result.error });
    }
    const { guard } = push;
    if (guard.kind === 'confirmed') {
      const result = await forcePushSessionBranch({
        get,
        sessionId,
        mountId,
        confirmedOnlyOnline: guard.confirmedOnlyOnline,
        confirmedRemoteSha: guard.confirmedRemoteSha,
      });
      return result.ok ? result : failureOf({ error: result.error });
    }
    return pushExpectedLease({
      get,
      sessionId,
      mountId,
      expectedRemoteSha: guard.expectedRemoteSha,
      ...(guard.sha !== undefined && { sha: guard.sha }),
      ...(guard.worktreePath !== undefined && { worktreePath: guard.worktreePath }),
      ...(guard.branch !== undefined && { branch: guard.branch }),
    });
  };
  return async ({ sessionId, mountId, ...push }: BranchPushParams): Promise<BranchPushResult> => {
    let result: BranchPushResult;
    try {
      result = await run({ sessionId, mountId, push });
    } catch (error) {
      return { ok: false, error: formatError(error), reason: 'failed' };
    }
    if (!result.ok || push.mode !== 'lease') {
      return result;
    }
    try {
      await settleHistoryPush({ set, get, sessionId, mountId });
    } catch (error) {
      await get().reportError({
        title: "Couldn't finish recording the push.",
        error,
        severity: 'warning',
        sessionId,
      });
    }
    return result;
  };
};
