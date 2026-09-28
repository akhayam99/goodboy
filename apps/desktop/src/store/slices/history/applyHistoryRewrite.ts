import { markHistoryPlan } from '@goodboy/db';
import { formatError } from '@goodboy/ui';
import { tauriDatabase } from '../../../shared/lib/db';
import { applyHistoryPlan, pushWithLease } from '../../../features/history/historyEngine';
import { refreshWorktreeStatuses } from '../../../features/session/hooks/useWorktreeStatuses/cache';
import { historyTargetOf } from './historyTargetOf';
import { remoteForPush } from './remoteForPush';
import { remapRewrittenCommits } from './remapRewrittenCommits';
import { setHistoryRun } from './setHistoryRun';
import { recordHistoryEvent } from './recordHistoryEvent';
import { reportHistoryStop } from './reportHistoryStop';
import type {
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
    const remote = await remoteForPush({
      target,
      expectedHead: input.expectedHead,
      incorporated: input.incorporatedRemoteSha ?? null,
      shouldPush: input.shouldPush,
    });
    if (remote.stop !== null) {
      return stopWith(remote.stop);
    }
    const startedAt = Date.now();
    setHistoryRun({ set, sessionId, mountId, origin, patch: { phase: 'applying', planId } });
    while (true) {
      const outcome = await applyHistoryPlan({
        worktreePath: target.worktreePath,
        branch: target.branch,
        expectedHead: input.expectedHead,
        newHead: input.newHead,
      }).catch((error: unknown) => ({ kind: 'failed' as const, message: formatError(error) }));
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
      await remapRewrittenCommits({ set, get, sessionId, map: input.map });
      await recordHistoryEvent({
        get,
        kind: 'history_rewritten',
        target,
        origin,
        planId,
        extra: {
          backupRef: outcome.backupRef,
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
          phase: 'applied',
          backupRef: outcome.backupRef,
          remoteSha: remote.sha,
          holder: null,
          stop: null,
          result: null,
          copyPath: null,
        },
      });
      break;
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
    });
  };
};

type PushInput = {
  readonly sessionId: ApplyHistoryRewriteInput['sessionId'];
  readonly mountId: ApplyHistoryRewriteInput['mountId'];
  readonly origin: ApplyHistoryRewriteInput['origin'];
  readonly planId: string | null;
  readonly expectedRemoteSha: string | null;
};

export const pushHistoryRewrite = (set: SetFn, get: GetFn) => {
  return async ({
    sessionId,
    mountId,
    origin,
    planId,
    expectedRemoteSha,
  }: PushInput): Promise<ApplyHistoryRewriteOutcome> => {
    const target = historyTargetOf({ get, sessionId, mountId });
    setHistoryRun({ set, sessionId, mountId, origin, patch: { phase: 'pushing', planId } });
    const pushed = await pushWithLease({
      worktreePath: target.worktreePath,
      branch: target.branch,
      expectedRemoteSha,
      workspaceId: target.workspaceId,
      projectId: target.projectId,
    }).catch((error: unknown) => ({ kind: 'failed' as const, message: formatError(error) }));
    if (pushed.kind === 'pushed') {
      setHistoryRun({ set, sessionId, mountId, origin, patch: { phase: 'pushed', stop: null } });
      if (planId !== null) {
        await markHistoryPlan({
          db: tauriDatabase,
          id: planId,
          state: 'pushed',
          at: Date.now(),
        }).catch(() => undefined);
      }
      const prNumber = get().mountGithub[mountId]?.pr?.number ?? null;
      await recordHistoryEvent({
        get,
        kind: 'history_pushed',
        target,
        origin,
        planId,
        extra: prNumber === null ? {} : { prNumber },
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
            message: 'Origin has new commits since the rewrite. Nothing was pushed.',
            files: [],
            sha: null,
          }
        : { reason: 'failed', message: pushed.message, files: [], sha: null };
    setHistoryRun({ set, sessionId, mountId, origin, patch: { phase: 'stopped', stop } });
    await reportHistoryStop({ get, set, target, origin, stop, planId });
    return 'stopped';
  };
};
