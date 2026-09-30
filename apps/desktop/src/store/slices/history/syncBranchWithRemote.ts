import { formatError } from '@goodboy/ui';
import {
  discardHistoryCopy,
  predictHistoryPlan,
  readRebasePlan,
  tryHistoryPlan,
} from '../../../features/history/historyEngine';
import { historyTargetOf } from './historyTargetOf';
import { identityOf } from './historyIdentity';
import { isHistoryRunActive } from './isHistoryRunActive';
import { rebasePlanArgs } from './rebaseBranch';
import type { GetFn, HistoryMountInput, SetFn } from './types';

export type SyncBranchOutcome =
  | { readonly kind: 'synced'; readonly count: number }
  | { readonly kind: 'nothing' }
  | { readonly kind: 'conflict' }
  | { readonly kind: 'busy' }
  | { readonly kind: 'failed'; readonly message: string };

const failed = ({ message }: { readonly message: string }): SyncBranchOutcome => ({
  kind: 'failed',
  message,
});

export const syncBranchWithRemote = (_set: SetFn, get: GetFn) => {
  return async ({ sessionId, mountId }: HistoryMountInput): Promise<SyncBranchOutcome> => {
    const current = get().historyRuns[mountId];
    if (current !== undefined && isHistoryRunActive({ phase: current.phase })) {
      return { kind: 'busy' };
    }
    const target = historyTargetOf({ get, sessionId, mountId });
    const rebase = await readRebasePlan({
      worktreePath: target.worktreePath,
      baseBranch: target.branch,
      fetches: true,
    }).catch((error: unknown) => formatError(error));
    if (typeof rebase === 'string') {
      return failed({ message: rebase });
    }
    if (rebase.fetchError !== null) {
      return failed({ message: `Couldn't reach origin: ${rebase.fetchError}` });
    }
    if (rebase.behind === 0 || rebase.commits.length === 0) {
      return { kind: 'nothing' };
    }
    const plan = rebasePlanArgs({ worktreePath: target.worktreePath, rebase });
    const prediction = await predictHistoryPlan(plan).catch(() => null);
    if (prediction !== null && prediction.isSupported && prediction.head === null) {
      return { kind: 'conflict' };
    }
    const trial = await tryHistoryPlan(plan).catch((error: unknown) => formatError(error));
    if (typeof trial === 'string') {
      return failed({ message: trial });
    }
    if (trial.stop !== null || trial.head === null) {
      if (trial.copyPath !== null) {
        await discardHistoryCopy({
          worktreePath: target.worktreePath,
          copyPath: trial.copyPath,
        }).catch(() => undefined);
      }
      return { kind: 'conflict' };
    }
    if (trial.check?.isPassed === false) {
      return failed({
        message: `The rebase on the copy did not match the branch: ${trial.check.problems.join(' ')} Nothing was changed.`,
      });
    }
    const applied = await get().applyHistoryRewrite({
      sessionId,
      mountId,
      origin: 'rebase',
      planId: null,
      newHead: trial.head,
      expectedHead: plan.head,
      map: trial.map,
      shouldPush: false,
      byAgent: false,
      identity: identityOf({ target }),
      summary: `${rebase.behind} from origin brought under the local commits`,
    });
    if (applied === 'busy') {
      return { kind: 'busy' };
    }
    if (applied === 'stopped') {
      return failed({
        message: get().historyRuns[mountId]?.stop?.message ?? "Couldn't rebase the branch.",
      });
    }
    return { kind: 'synced', count: rebase.behind };
  };
};
