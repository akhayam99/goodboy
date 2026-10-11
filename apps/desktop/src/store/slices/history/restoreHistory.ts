import { formatError } from '@goodboy/ui';
import { pushWithLease, restoreHistoryBackup } from '../../../features/history/historyEngine';
import { worktreeStatus } from '../../../features/worktree/worktree';
import { assertCleanTree } from './assertCleanTree';
import { identityOf, identityChange } from './historyIdentity';
import { historyTargetOf } from './historyTargetOf';
import { remoteForPush } from './remoteForPush';
import { recordHistoryEvent } from './recordHistoryEvent';
import { reportHistoryStop } from './reportHistoryStop';
import { setHistoryRun } from './setHistoryRun';
import type { GetFn, HistoryMountInput, HistoryIdentity, HistoryStop, SetFn } from './types';

export type RestoreHistoryInput = HistoryMountInput & {
  readonly backupRef: string;
  readonly shouldPush: boolean;
  readonly expectedHead?: string;
  readonly shouldStash?: boolean;
  readonly identity?: HistoryIdentity;
};

export type RestoreHistoryOutcome = 'restored' | 'pushed' | 'stopped';

export const restoreHistory = (set: SetFn, get: GetFn) => {
  return async ({
    sessionId,
    mountId,
    backupRef,
    shouldPush,
    shouldStash,
    identity,
    expectedHead,
  }: RestoreHistoryInput): Promise<RestoreHistoryOutcome> => {
    const target = historyTargetOf({ get, sessionId, mountId });
    const sourceRun = get().historyRuns[mountId];
    await assertCleanTree({
      worktreePath: target.worktreePath,
      baseBranch: target.baseBranch,
      canCarryDirty: true,
    });
    const capturedIdentity = identity ?? identityOf({ target });
    const changed = identityChange({ get, sessionId, mountId, identity: capturedIdentity });
    if (changed !== null) {
      throw new Error(changed);
    }
    const origin = get().historyRuns[mountId]?.origin ?? 'plan';
    const stopWith = async (stop: HistoryStop): Promise<RestoreHistoryOutcome> => {
      setHistoryRun({ set, sessionId, mountId, origin, patch: { phase: 'stopped', stop } });
      await reportHistoryStop({ get, set, target, origin, stop, planId: null });
      return 'stopped';
    };
    const status = await worktreeStatus({
      worktreePath: target.worktreePath,
      baseBranch: target.baseBranch,
    }).catch(() => null);
    if (status === null || status.head === null) {
      return stopWith({
        reason: 'failed',
        message: "Couldn't read the branch head.",
        files: [],
        sha: null,
      });
    }
    if (expectedHead !== undefined && status.head !== expectedHead) {
      return stopWith({
        reason: 'head-moved',
        message: 'The branch moved while you were choosing. Nothing was changed.',
        files: [],
        sha: status.head,
      });
    }
    const run = get().historyRuns[mountId];
    const isPushed = run?.phase === 'pushed';
    const remote = await remoteForPush({
      target,
      expectedHead: backupRef,
      incorporated: isPushed ? run.movedHead : null,
      incorporatedSince: isPushed ? run.remoteSha : null,
      shouldPush,
    });
    if (
      get().historyRuns[mountId] !== sourceRun ||
      identityChange({ get, sessionId, mountId, identity: capturedIdentity }) !== null
    ) {
      return 'stopped';
    }
    const remoteSha = remote.sha;
    setHistoryRun({ set, sessionId, mountId, origin, patch: { phase: 'applying', stop: null } });
    const requestRun = get().historyRuns[mountId];
    const moved = await restoreHistoryBackup({
      worktreePath: target.worktreePath,
      branch: target.branch,
      expectedHead: status.head,
      backupRef,
      ...(shouldStash === true ? { shouldStash: true } : {}),
    }).catch((error: unknown) => ({ kind: 'failed' as const, message: formatError(error) }));
    if (
      get().historyRuns[mountId] !== requestRun ||
      identityChange({ get, sessionId, mountId, identity: capturedIdentity }) !== null
    ) {
      return 'stopped';
    }
    if (moved.kind === 'needs-stash') {
      setHistoryRun({
        set,
        sessionId,
        mountId,
        origin,
        patch: {
          phase: 'choosing',
          pendingMove: {
            kind: 'restore',
            input: {
              sessionId,
              mountId,
              backupRef,
              shouldPush,
              expectedHead: status.head,
              identity: capturedIdentity,
            },
          },
          dirtyChoice: { files: moved.files, dirtyCount: moved.dirtyCount },
        },
      });
      return 'stopped';
    }
    if (moved.kind === 'set-aside') {
      setHistoryRun({
        set,
        sessionId,
        mountId,
        origin,
        patch: {
          phase: 'set-aside',
          savedStash: {
            sha: moved.stash,
            identity: capturedIdentity,
            expectedHead: status.head,
            files: [],
          },
        },
      });
      return 'stopped';
    }
    if (moved.kind === 'files-restored') {
      return 'stopped';
    }
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
    if (run !== undefined && run.backupRef === backupRef) {
      for (const shas of run.threadShas) {
        await get()
          .updateResolveThread({
            sessionId,
            threadId: shas.threadId,
            patch: {
              commitShas: shas.commitShas,
              fixupOfSha: shas.fixupOfSha,
              replacesSha: shas.replacesSha,
            },
          })
          .catch(() => false);
      }
    }
    if (
      get().historyRuns[mountId] !== requestRun ||
      identityChange({ get, sessionId, mountId, identity: capturedIdentity }) !== null
    ) {
      return 'stopped';
    }
    setHistoryRun({
      set,
      sessionId,
      mountId,
      origin,
      patch: {
        phase: moved.kind === 'restore-conflict' ? 'restore-conflict' : 'restored',
        movedHead: moved.head,
        savedStash:
          moved.kind === 'restore-conflict'
            ? {
                sha: moved.stash,
                identity: capturedIdentity,
                expectedHead: moved.head,
                files: moved.files,
              }
            : undefined,
        pendingMove: undefined,
        dirtyChoice: undefined,
        backupRef: moved.backupRef,
        result: null,
        applied: null,
        threadShas: [],
      },
    });
    await recordHistoryEvent({
      get,
      kind: 'history_restored',
      target,
      origin,
      planId: null,
      extra: { backupRef },
    });
    if (moved.kind === 'restore-conflict') {
      return 'stopped';
    }
    await get().loadHistoryDraft({ sessionId, mountId });
    if (moved.cleanupError !== undefined) {
      await get().reportError({
        title: 'Your files are back, but stash cleanup needs attention',
        error: moved.cleanupError,
        severity: 'warning',
        sessionId,
      });
      return 'restored';
    }
    if (!shouldPush || !remote.hasUpstream) {
      return 'restored';
    }
    if (remote.stop !== null) {
      return stopWith({
        reason: remote.stop.reason,
        message:
          remote.stop.reason === 'origin-moved'
            ? 'Restored here. The online copy has newer commits than this backup, so nothing was pushed.'
            : `Restored here, but the online copy could not be checked, so nothing was pushed.`,
        files: [],
        sha: remote.stop.sha,
      });
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
