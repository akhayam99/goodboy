import { formatError } from '@goodboy/ui';
import { applyHistoryPlan, pushWithLease } from '../../../features/history/historyEngine';
import { worktreeRemoteHead, worktreeStatus } from '../../../features/worktree/worktree';
import { historyTargetOf } from './historyTargetOf';
import { remapRewrittenCommits } from './remapRewrittenCommits';
import { setHistoryRun } from './setHistoryRun';
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

type RemoteParams = {
  readonly worktreePath: string;
  readonly branch: string;
};

const remoteHeadOf = async ({
  worktreePath,
  branch,
}: RemoteParams): Promise<{ readonly hasUpstream: boolean; readonly sha: string | null }> => {
  const status = await worktreeStatus({ worktreePath }).catch(() => null);
  if (status === null || status.upstream === null) {
    return { hasUpstream: false, sha: null };
  }
  const sha = await worktreeRemoteHead({ worktreePath, branch }).catch(() => null);
  return { hasUpstream: true, sha };
};

export const applyHistoryRewrite = (set: SetFn, get: GetFn) => {
  return async (input: ApplyHistoryRewriteInput): Promise<ApplyHistoryRewriteOutcome> => {
    const { sessionId, mountId, origin, planId } = input;
    const target = historyTargetOf({ get, sessionId, mountId });
    const stopWith = async (stop: HistoryStop): Promise<ApplyHistoryRewriteOutcome> => {
      setHistoryRun({ set, sessionId, mountId, origin, patch: { phase: 'stopped', stop, planId } });
      await reportHistoryStop({ get, set, target, origin, stop, planId });
      return 'stopped';
    };
    const remote = await remoteHeadOf({ worktreePath: target.worktreePath, branch: target.branch });
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
      setHistoryRun({
        set,
        sessionId,
        mountId,
        origin,
        patch: {
          phase: 'applied',
          backupRef: outcome.backupRef,
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
      return 'pushed';
    }
    const stop: HistoryStop =
      pushed.kind === 'stale'
        ? {
            reason: 'origin-moved',
            message: 'Origin moved since the rewrite. Nothing was pushed.',
            files: [],
            sha: null,
          }
        : { reason: 'failed', message: pushed.message, files: [], sha: null };
    setHistoryRun({ set, sessionId, mountId, origin, patch: { phase: 'stopped', stop } });
    await reportHistoryStop({ get, set, target, origin, stop, planId });
    return 'stopped';
  };
};
