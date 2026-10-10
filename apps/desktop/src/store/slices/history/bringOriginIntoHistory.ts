import { formatError } from '@goodboy/ui';
import { readOriginAhead, tryHistoryPlan } from '../../../features/history/historyEngine';
import { worktreeStatus } from '../../../features/worktree/worktree';
import { assertCleanTree } from './assertCleanTree';
import { historyTargetOf } from './historyTargetOf';
import { identityOf } from './historyIdentity';
import { reportHistoryStop } from './reportHistoryStop';
import { setHistoryRun } from './setHistoryRun';
import type {
  ApplyHistoryRewriteOutcome,
  GetFn,
  HistoryMountInput,
  HistoryStop,
  SetFn,
} from './types';

export type BringOriginOutcome = ApplyHistoryRewriteOutcome | 'rewriting' | 'nothing';

export const bringOriginIntoHistory = (set: SetFn, get: GetFn) => {
  return async ({ sessionId, mountId }: HistoryMountInput): Promise<BringOriginOutcome> => {
    const target = historyTargetOf({ get, sessionId, mountId });
    await assertCleanTree({ worktreePath: target.worktreePath, baseBranch: target.baseBranch });
    const run = get().historyRuns[mountId];
    const origin = run?.origin ?? 'plan';
    const planId = run?.planId ?? null;
    const stopWith = async (stop: HistoryStop): Promise<BringOriginOutcome> => {
      setHistoryRun({ set, sessionId, mountId, origin, patch: { phase: 'stopped', stop } });
      await reportHistoryStop({ get, set, target, origin, stop, planId });
      return 'stopped';
    };
    setHistoryRun({ set, sessionId, mountId, origin, patch: { phase: 'trying', stop: null } });
    const ahead = await readOriginAhead({
      worktreePath: target.worktreePath,
      branch: target.branch,
      since: run?.remoteSha ?? null,
      workspaceId: target.workspaceId,
      projectId: target.projectId,
    }).catch((error: unknown) => formatError(error));
    if (typeof ahead === 'string') {
      return stopWith({ reason: 'failed', message: ahead, files: [], sha: null });
    }
    const status = await worktreeStatus({
      worktreePath: target.worktreePath,
      baseBranch: target.baseBranch,
    }).catch(() => null);
    const head = status?.head ?? null;
    if (head === null) {
      return stopWith({
        reason: 'failed',
        message: "Couldn't read the branch head.",
        files: [],
        sha: null,
      });
    }
    if (ahead.commits.length === 0) {
      setHistoryRun({
        set,
        sessionId,
        mountId,
        origin,
        patch: { phase: 'applied', stop: null, remoteSha: ahead.remoteSha },
      });
      return 'nothing';
    }
    const plan = {
      worktreePath: target.worktreePath,
      base: head,
      head,
      steps: ahead.commits.map((commit) => ({ sha: commit.sha, verb: 'pick' as const })),
    };
    const trial = await tryHistoryPlan(plan).catch((error: unknown) => formatError(error));
    if (typeof trial === 'string') {
      return stopWith({ reason: 'failed', message: trial, files: [], sha: null });
    }
    if (trial.check?.isPassed === false) {
      return stopWith({
        reason: 'unverified',
        message: `Bringing origin in did not check out on the copy: ${trial.check.problems.join(' ')} Nothing was changed.`,
        files: trial.check.unexpectedFiles,
        sha: null,
      });
    }
    if (trial.stop !== null || trial.head === null) {
      const started = await get().startHistoryRewriter({
        sessionId,
        mountId,
        plan,
        origin,
        planId,
      });
      return started === 'rewriting' ? 'rewriting' : 'stopped';
    }
    const outcome = await get().applyHistoryRewrite({
      sessionId,
      mountId,
      origin,
      planId,
      newHead: trial.head,
      expectedHead: head,
      map: trial.map,
      shouldPush: false,
      byAgent: false,
      identity: identityOf({ target }),
      summary: `${ahead.commits.length} from origin brought in`,
      incorporatedRemoteSha: ahead.remoteSha,
    });
    await get().loadHistoryDraft({ sessionId, mountId });
    return outcome;
  };
};
