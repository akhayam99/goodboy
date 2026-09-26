import { hasPushedHistoryPlan } from '@goodboy/db';
import { formatError } from '@goodboy/ui';
import { pushWithLease, restoreHistoryBackup } from '../../../features/history/historyEngine';
import { worktreeRemoteHead, worktreeStatus } from '../../../features/worktree/worktree';
import { tauriDatabase } from '../../../shared/lib/db';
import { historyTargetOf } from './historyTargetOf';
import { reportHistoryStop } from './reportHistoryStop';
import { setHistoryRun } from './setHistoryRun';
import type { GetFn, HistoryMountInput, HistoryStop, SetFn } from './types';

export type RestoreHistoryInput = HistoryMountInput & {
  readonly backupRef: string;
  readonly shouldPush: boolean;
};

export type RestoreHistoryOutcome = 'restored' | 'pushed' | 'stopped';

export const restoreHistory = (set: SetFn, get: GetFn) => {
  return async ({
    sessionId,
    mountId,
    backupRef,
    shouldPush,
  }: RestoreHistoryInput): Promise<RestoreHistoryOutcome> => {
    const target = historyTargetOf({ get, sessionId, mountId });
    const origin = get().historyRuns[mountId]?.origin ?? 'plan';
    const stopWith = async (stop: HistoryStop): Promise<RestoreHistoryOutcome> => {
      setHistoryRun({ set, sessionId, mountId, origin, patch: { phase: 'stopped', stop } });
      await reportHistoryStop({ get, set, target, origin, stop, planId: null });
      return 'stopped';
    };
    const status = await worktreeStatus({ worktreePath: target.worktreePath }).catch(() => null);
    if (status === null || status.head === null) {
      return stopWith({
        reason: 'failed',
        message: "Couldn't read the branch head.",
        files: [],
        sha: null,
      });
    }
    const remoteSha =
      shouldPush && status.upstream !== null
        ? await worktreeRemoteHead({
            worktreePath: target.worktreePath,
            branch: target.branch,
          }).catch(() => null)
        : null;
    setHistoryRun({ set, sessionId, mountId, origin, patch: { phase: 'applying', stop: null } });
    const moved = await restoreHistoryBackup({
      worktreePath: target.worktreePath,
      branch: target.branch,
      expectedHead: status.head,
      backupRef,
    }).catch((error: unknown) => ({ kind: 'failed' as const, message: formatError(error) }));
    if (moved.kind === 'failed') {
      return stopWith({ reason: 'failed', message: moved.message, files: [], sha: null });
    }
    if (moved.kind === 'busy') {
      return stopWith({
        reason: 'blocked',
        message: `${moved.holder ?? 'An agent'} is writing here. Restore when it finishes.`,
        files: [],
        sha: null,
      });
    }
    if (moved.kind === 'head-moved') {
      return stopWith({
        reason: 'head-moved',
        message: 'The branch moved while restoring. Nothing was changed.',
        files: [],
        sha: moved.head,
      });
    }
    if (moved.kind === 'blocked') {
      return stopWith({ reason: 'blocked', message: moved.reason, files: [], sha: null });
    }
    setHistoryRun({
      set,
      sessionId,
      mountId,
      origin,
      patch: { phase: 'restored', backupRef: moved.backupRef, result: null },
    });
    await get().loadHistoryDraft({ sessionId, mountId });
    if (!shouldPush || status.upstream === null) {
      return 'restored';
    }
    const pushed = await pushWithLease({
      worktreePath: target.worktreePath,
      branch: target.branch,
      expectedRemoteSha: remoteSha,
      workspaceId: target.workspaceId,
      projectId: target.projectId,
    }).catch((error: unknown) => ({ kind: 'failed' as const, message: formatError(error) }));
    if (pushed.kind === 'pushed') {
      return 'pushed';
    }
    return stopWith({
      reason: pushed.kind === 'stale' ? 'origin-moved' : 'failed',
      message:
        pushed.kind === 'stale'
          ? 'Origin moved since the rewrite. The old history is back here, nothing was pushed.'
          : pushed.message,
      files: [],
      sha: null,
    });
  };
};

type BranchInput = {
  readonly mountId: HistoryMountInput['mountId'];
  readonly branch: string;
};

export const hasPushedHistoryBefore = () => {
  return async ({ mountId, branch }: BranchInput): Promise<boolean> =>
    hasPushedHistoryPlan({ db: tauriDatabase, mountId, branch }).catch(() => false);
};
