import type { HistoryPlanArgs, HistoryRebasePlan } from '@goodboy/types';
import { formatError } from '@goodboy/ui';
import {
  predictHistoryPlan,
  readRebasePlan,
  tryHistoryPlan,
} from '../../../features/history/historyEngine';
import { assertCleanTree } from './assertCleanTree';
import { historyTargetOf } from './historyTargetOf';
import { identityOf } from './historyIdentity';
import { isHistoryRunActive } from './isHistoryRunActive';
import { reportHistoryStop } from './reportHistoryStop';
import { setHistoryRun } from './setHistoryRun';
import type { GetFn, HistoryMountInput, HistoryStop, RebaseBranchOutcome, SetFn } from './types';

type PlanParams = {
  readonly worktreePath: string;
  readonly rebase: HistoryRebasePlan;
};

export const rebasePlanArgs = ({ worktreePath, rebase }: PlanParams): HistoryPlanArgs => ({
  worktreePath,
  base: rebase.mergeBase,
  head: rebase.head,
  steps: rebase.commits.map((commit) => ({ sha: commit.sha, verb: 'pick' as const })),
  onto: rebase.onto,
});

export const rebaseBranch = (set: SetFn, get: GetFn) => {
  return async ({ sessionId, mountId }: HistoryMountInput): Promise<RebaseBranchOutcome> => {
    const target = historyTargetOf({ get, sessionId, mountId });
    await assertCleanTree({ worktreePath: target.worktreePath, baseBranch: target.baseBranch });
    const current = get().historyRuns[mountId];
    if (current !== undefined && isHistoryRunActive({ phase: current.phase })) {
      return 'busy';
    }
    const origin = 'rebase' as const;
    const stopWith = async (stop: HistoryStop): Promise<RebaseBranchOutcome> => {
      setHistoryRun({ set, sessionId, mountId, origin, patch: { phase: 'stopped', stop } });
      await reportHistoryStop({ get, set, target, origin, stop, planId: null });
      return 'stopped';
    };
    setHistoryRun({
      set,
      sessionId,
      mountId,
      origin,
      patch: { phase: 'predicting', stop: null, result: null, agentId: null, planId: null },
    });
    const rebase = await readRebasePlan({
      worktreePath: target.worktreePath,
      baseBranch: target.baseBranch,
      fetches: true,
    }).catch((error: unknown) => formatError(error));
    if (typeof rebase === 'string') {
      return stopWith({ reason: 'failed', message: rebase, files: [], sha: null });
    }
    void get().recordSessionEvent({
      sessionId,
      kind: 'rebase_requested',
      payload: {
        mountId,
        projectId: target.projectId,
        projectName: target.projectName,
        worktreePath: target.worktreePath,
        branch: target.baseBranch ?? rebase.ontoRef,
        behind: rebase.behind,
      },
    });
    const plan = rebasePlanArgs({ worktreePath: target.worktreePath, rebase });
    const prediction = await predictHistoryPlan(plan).catch(() => null);
    const isConflictPredicted =
      prediction !== null && prediction.isSupported && prediction.head === null;
    if (!isConflictPredicted) {
      setHistoryRun({ set, sessionId, mountId, origin, patch: { phase: 'trying' } });
      const trial = await tryHistoryPlan(plan).catch((error: unknown) => formatError(error));
      if (typeof trial === 'string') {
        return stopWith({ reason: 'failed', message: trial, files: [], sha: null });
      }
      if (trial.stop === null && trial.head !== null && trial.check?.isPassed === false) {
        return stopWith({
          reason: 'unverified',
          message: `The rebase on the copy did not match the branch: ${trial.check.problems.join(' ')} Nothing was changed.`,
          files: trial.check.unexpectedFiles,
          sha: null,
        });
      }
      if (trial.stop === null && trial.head !== null) {
        const applied = await get().applyHistoryRewrite({
          sessionId,
          mountId,
          origin,
          planId: null,
          newHead: trial.head,
          expectedHead: plan.head,
          map: trial.map,
          shouldPush: true,
          byAgent: false,
          identity: identityOf({ target }),
        });
        return applied === 'stopped' || applied === 'busy' ? applied : 'rebased';
      }
    }
    const started = await get().startHistoryRewriter({
      sessionId,
      mountId,
      plan,
      origin,
      planId: null,
    });
    if (started === 'rewriting') {
      return 'rewriting';
    }
    return started === 'stopped' || started === 'busy' ? started : 'rebased';
  };
};
