import type { HistoryPlanArgs, HistoryRebasePlan } from '@goodboy/types';
import { formatError } from '@goodboy/ui';
import {
  predictHistoryPlan,
  readRebasePlan,
  tryHistoryPlan,
} from '../../../features/history/historyEngine';
import { assertCleanTree } from './assertCleanTree';
import { DirtyTreeError } from './DirtyTreeError';
import { historyTargetOf } from './historyTargetOf';
import { identityOf, identityChange } from './historyIdentity';
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
    const identity = identityOf({ target });
    const origin = 'rebase' as const;
    const stopWith = async (stop: HistoryStop): Promise<RebaseBranchOutcome> => {
      setHistoryRun({ set, sessionId, mountId, origin, patch: { phase: 'stopped', stop } });
      await reportHistoryStop({ get, set, target, origin, stop, planId: null });
      return 'stopped';
    };
    const current = get().historyRuns[mountId];
    if (
      current !== undefined &&
      (isHistoryRunActive({ phase: current.phase }) ||
        current.phase === 'choosing' ||
        current.phase === 'set-aside' ||
        current.phase === 'restore-conflict')
    ) {
      return 'busy';
    }
    try {
      await assertCleanTree({
        worktreePath: target.worktreePath,
        baseBranch: target.baseBranch,
        canCarryDirty: true,
      });
    } catch (error) {
      if (error instanceof DirtyTreeError) {
        return stopWith({ reason: 'dirty', message: error.message, files: [], sha: null });
      }
      throw error;
    }
    setHistoryRun({
      set,
      sessionId,
      mountId,
      origin,
      patch: {
        phase: 'predicting',
        stop: null,
        result: null,
        agentId: null,
        planId: null,
        progress: null,
        backupRef: null,
        applied: null,
        commitCount: null,
        pendingMove: undefined,
        dirtyChoice: undefined,
        savedStash: undefined,
        carriedCount: 0,
      },
    });
    let requestRun = get().historyRuns[mountId];
    const rebase = await readRebasePlan({
      worktreePath: target.worktreePath,
      baseBranch: target.baseBranch,
      fetches: true,
    }).catch((error: unknown) => formatError(error));
    if (
      get().historyRuns[mountId] !== requestRun ||
      identityChange({ get, sessionId, mountId, identity }) !== null
    ) {
      return 'stopped';
    }
    if (typeof rebase === 'string') {
      return stopWith({ reason: 'failed', message: rebase, files: [], sha: null });
    }
    if (rebase.setAside !== undefined && rebase.setAside !== null) {
      setHistoryRun({
        set,
        sessionId,
        mountId,
        origin,
        patch: {
          phase: 'set-aside',
          savedStash: { sha: rebase.setAside, identity, expectedHead: rebase.head, files: [] },
        },
      });
      return 'stopped';
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
    setHistoryRun({ set, sessionId, mountId, origin, patch: { commitCount: plan.steps.length } });
    requestRun = get().historyRuns[mountId];
    const prediction = await predictHistoryPlan(plan).catch(() => null);
    if (get().historyRuns[mountId] !== requestRun) {
      return 'stopped';
    }
    const isConflictPredicted =
      prediction !== null && prediction.isSupported && prediction.head === null;
    if (!isConflictPredicted) {
      setHistoryRun({ set, sessionId, mountId, origin, patch: { phase: 'trying' } });
      requestRun = get().historyRuns[mountId];
      const trial = await tryHistoryPlan(plan).catch((error: unknown) => formatError(error));
      if (get().historyRuns[mountId] !== requestRun) {
        return 'stopped';
      }
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
