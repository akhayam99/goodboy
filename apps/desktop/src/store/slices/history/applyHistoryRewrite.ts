import { markHistoryPlan } from '@goodboy/db';
import { formatError } from '@goodboy/ui';
import { tauriDatabase } from '../../../shared/lib/db';
import { applyHistoryPlan, pushWithLease } from '../../../features/history/historyEngine';
import { ORIGIN_MOVED_MESSAGE } from '../../../features/history/originMovedMessage';
import { refreshWorktreeStatuses } from '../worktreeStatuses/cache';
import { historyTargetOf } from './historyTargetOf';
import { identityChange } from './historyIdentity';
import { editPostedReplies } from '../resolve/editPostedReplies';
import { remoteForPush } from './remoteForPush';
import { remapRewrittenCommits } from './remapRewrittenCommits';
import { shouldHandleLateOutcome } from './shouldHandleLateOutcome';
import { setHistoryRun } from './setHistoryRun';
import { recordHistoryEvent } from './recordHistoryEvent';
import { reportHistoryStop } from './reportHistoryStop';
import type {
  HistoryIdentity,
  ApplyHistoryRewriteInput,
  ApplyHistoryRewriteOutcome,
  GetFn,
  HistoryStop,
  SetFn,
} from './types';

const WAIT_STEP_MS = 2_000;
const WAIT_LIMIT_MS = 10 * 60 * 1_000;

const sleep = ({ ms }: { readonly ms: number }): Promise<void> =>
  new Promise((resolve) => {
    setTimeout(resolve, ms);
  });

export const applyHistoryRewrite = (set: SetFn, get: GetFn) => {
  return async (input: ApplyHistoryRewriteInput): Promise<ApplyHistoryRewriteOutcome> => {
    const { sessionId, mountId, origin, planId } = input;
    const target = historyTargetOf({ get, sessionId, mountId });
    const stopWith = async (stop: HistoryStop): Promise<ApplyHistoryRewriteOutcome> => {
      setHistoryRun({ set, sessionId, mountId, origin, patch: { phase: 'stopped', stop, planId } });
      await reportHistoryStop({ get, set, target, origin, stop, planId });
      return 'stopped';
    };
    const changed = identityChange({ get, sessionId, mountId, identity: input.identity });
    if (changed !== null) {
      return stopWith({ reason: 'blocked', message: changed, files: [], sha: null });
    }
    const sourceRun = get().historyRuns[mountId];
    const remote = await remoteForPush({
      target,
      expectedHead: input.expectedHead,
      incorporated: input.incorporatedRemoteSha ?? null,
      incorporatedSince: null,
      shouldPush: input.shouldPush,
    });
    if (
      get().historyRuns[mountId] !== sourceRun ||
      identityChange({ get, sessionId, mountId, identity: input.identity }) !== null
    ) {
      return 'stopped';
    }
    if (remote.stop !== null) {
      return stopWith(remote.stop);
    }
    const startedAt = Date.now();
    let cleanupError: string | undefined;
    let isLateMove = false;
    setHistoryRun({ set, sessionId, mountId, origin, patch: { phase: 'applying', planId } });
    while (true) {
      const requestRun = get().historyRuns[mountId];
      const outcome = await applyHistoryPlan({
        worktreePath: input.identity.worktreePath,
        branch: input.identity.branch,
        expectedHead: input.expectedHead,
        newHead: input.newHead,
        ...(input.shouldStash === true ? { shouldStash: true } : {}),
      }).catch((error: unknown) => ({ kind: 'failed' as const, message: formatError(error) }));
      const isLate =
        get().historyRuns[mountId] !== requestRun ||
        identityChange({ get, sessionId, mountId, identity: input.identity }) !== null;
      if (
        isLate &&
        !shouldHandleLateOutcome({
          outcome,
          isRunDismissed: get().historyRuns[mountId] === undefined,
        })
      ) {
        return 'stopped';
      }
      if (outcome.kind === 'needs-stash') {
        setHistoryRun({
          set,
          sessionId,
          mountId,
          origin,
          patch: {
            phase: 'choosing',
            pendingMove: { kind: 'apply', input: { ...input, shouldStash: undefined } },
            dirtyChoice: { files: outcome.files, dirtyCount: outcome.dirtyCount },
          },
        });
        return 'stopped';
      }
      if (outcome.kind === 'set-aside') {
        setHistoryRun({
          set,
          sessionId,
          mountId,
          origin,
          patch: {
            phase: 'set-aside',
            savedStash: {
              sha: outcome.stash,
              identity: input.identity,
              expectedHead: input.expectedHead,
              files: [],
            },
          },
        });
        return 'stopped';
      }
      if (outcome.kind === 'files-restored') {
        return 'stopped';
      }
      if (outcome.kind === 'busy') {
        if (Date.now() - startedAt > WAIT_LIMIT_MS) {
          return stopWith({
            reason: 'blocked',
            message: 'An agent kept writing in this worktree. Try again when it finishes.',
            files: [],
            sha: null,
          });
        }
        setHistoryRun({
          set,
          sessionId,
          mountId,
          origin,
          patch: { phase: 'waiting', holder: outcome.holder },
        });
        await sleep({ ms: WAIT_STEP_MS });
        continue;
      }
      if (outcome.kind === 'failed') {
        return stopWith({ reason: 'failed', message: outcome.message, files: [], sha: null });
      }
      if (outcome.kind === 'head-moved') {
        return stopWith({
          reason: 'head-moved',
          message: 'The branch moved while the plan was prepared. Nothing was changed.',
          files: [],
          sha: outcome.head,
        });
      }
      if (outcome.kind === 'blocked') {
        return stopWith({ reason: 'blocked', message: outcome.reason, files: [], sha: null });
      }
      const threadShas = await remapRewrittenCommits({ set, get, sessionId, map: input.map });
      const agentId = get().historyRuns[mountId]?.agentId ?? null;
      await recordHistoryEvent({
        get,
        kind: 'history_rewritten',
        target,
        origin,
        planId,
        extra: {
          backupRef: outcome.backupRef,
          ...(agentId !== null && { agentId }),
          ...(input.summary !== undefined && { summary: input.summary }),
          ...(input.isTreeEqual !== undefined && { isTreeEqual: input.isTreeEqual }),
        },
      });
      if (planId !== null) {
        await markHistoryPlan({
          db: tauriDatabase,
          id: planId,
          state: 'applied',
          at: Date.now(),
          backupRef: outcome.backupRef,
          remoteShaAtApply: remote.sha,
        }).catch(() => undefined);
      }
      setHistoryRun({
        set,
        sessionId,
        mountId,
        origin,
        patch: {
          phase: outcome.kind === 'restore-conflict' ? 'restore-conflict' : 'applied',
          carriedCount: outcome.kind === 'moved' ? (outcome.carriedCount ?? 0) : 0,
          savedStash:
            outcome.kind === 'restore-conflict'
              ? {
                  sha: outcome.stash,
                  identity: input.identity,
                  expectedHead: outcome.head,
                  files: outcome.files,
                }
              : undefined,
          pendingMove: undefined,
          dirtyChoice: undefined,
          backupRef: outcome.backupRef,
          remoteSha: remote.sha,
          holder: null,
          stop: null,
          result: null,
          copyPath: null,
          identity: input.identity,
          movedHead: outcome.head,
          threadShas,
        },
      });
      if (outcome.kind === 'restore-conflict') {
        return 'stopped';
      }
      cleanupError = outcome.cleanupError;
      isLateMove = isLate;
      break;
    }
    await refreshWorktreeStatuses({ worktreePaths: [target.worktreePath] }).catch(() => undefined);
    if (isLateMove) {
      return 'applied';
    }
    if (cleanupError !== undefined) {
      await get().reportError({
        title: 'Your files are back, but stash cleanup needs attention',
        error: cleanupError,
        severity: 'warning',
        sessionId,
      });
      return 'applied';
    }
    if (!input.shouldPush || !remote.hasUpstream) {
      return 'applied';
    }
    return get().pushHistoryRewrite({
      sessionId,
      mountId,
      origin,
      planId,
      expectedRemoteSha: remote.sha,
      identity: input.identity,
    });
  };
};

type PushInput = {
  readonly sessionId: ApplyHistoryRewriteInput['sessionId'];
  readonly mountId: ApplyHistoryRewriteInput['mountId'];
  readonly origin: ApplyHistoryRewriteInput['origin'];
  readonly planId: string | null;
  readonly expectedRemoteSha: string | null;
  readonly identity: HistoryIdentity | null;
};

export const pushHistoryRewrite = (set: SetFn, get: GetFn) => {
  return async ({
    sessionId,
    mountId,
    origin,
    planId,
    expectedRemoteSha,
    identity,
  }: PushInput): Promise<ApplyHistoryRewriteOutcome> => {
    const target = historyTargetOf({ get, sessionId, mountId });
    const changed =
      identity === null ? null : identityChange({ get, sessionId, mountId, identity });
    if (changed !== null) {
      const stop: HistoryStop = { reason: 'blocked', message: changed, files: [], sha: null };
      setHistoryRun({ set, sessionId, mountId, origin, patch: { phase: 'stopped', stop } });
      await reportHistoryStop({ get, set, target, origin, stop, planId });
      return 'stopped';
    }
    setHistoryRun({ set, sessionId, mountId, origin, patch: { phase: 'pushing', planId } });
    const pushed = await pushWithLease({
      worktreePath: identity?.worktreePath ?? target.worktreePath,
      branch: identity?.branch ?? target.branch,
      expectedRemoteSha,
      workspaceId: target.workspaceId,
      projectId: target.projectId,
    }).catch((error: unknown) => ({ kind: 'failed' as const, message: formatError(error) }));
    if (pushed.kind === 'pushed') {
      setHistoryRun({ set, sessionId, mountId, origin, patch: { phase: 'pushed', stop: null } });
      await refreshWorktreeStatuses({ worktreePaths: [target.worktreePath] }).catch(
        () => undefined,
      );
      if (planId !== null) {
        await markHistoryPlan({
          db: tauriDatabase,
          id: planId,
          state: 'pushed',
          at: Date.now(),
        }).catch(() => undefined);
      }
      await editPostedReplies({ set, get, sessionId }).catch(() => 0);
      const prNumber = get().mountGithub[mountId]?.pr?.number ?? null;
      const agentId = get().historyRuns[mountId]?.agentId ?? null;
      await recordHistoryEvent({
        get,
        kind: 'history_pushed',
        target,
        origin,
        planId,
        extra: {
          ...(prNumber !== null && { prNumber }),
          ...(agentId !== null && { agentId }),
        },
      });
      void get()
        .refreshPrDescription({ sessionId, mountId })
        .catch(() => false);
      void refreshWorktreeStatuses({ worktreePaths: [target.worktreePath] });
      void get().refreshSessionPr(sessionId, { mountId, force: true, silent: true });
      return 'pushed';
    }
    const stop: HistoryStop =
      pushed.kind === 'stale'
        ? {
            reason: 'origin-moved',
            message: ORIGIN_MOVED_MESSAGE,
            files: [],
            sha: null,
          }
        : { reason: 'push-failed', message: pushed.message, files: [], sha: null };
    setHistoryRun({ set, sessionId, mountId, origin, patch: { phase: 'stopped', stop } });
    await reportHistoryStop({ get, set, target, origin, stop, planId });
    return 'stopped';
  };
};
