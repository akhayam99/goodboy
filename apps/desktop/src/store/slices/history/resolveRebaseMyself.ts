import { readRebasePlan } from '../../../features/history/historyEngine';
import { rebaseConflictOf } from '../../../features/history/rebaseConflictOf';
import type { RebaseStop } from '../../../features/history/rebaseStopOf';
import { worktreeStartRebase, type RebaseStep } from '../../../features/worktree/worktree';
import type { SliceDeps } from '../../slice-types';
import { refreshWorktreeStatuses } from '../worktreeStatuses/cache';
import { identityChange, identityOf } from './historyIdentity';
import { historyTargetOf } from './historyTargetOf';
import { selectRebaseStop } from './selectRebaseStop';
import type { HistoryMountInput } from './types';

type SameStopParams = {
  readonly stop: RebaseStop;
  readonly now: RebaseStop | null;
};

const isSameStop = ({ stop, now }: SameStopParams): boolean =>
  now !== null &&
  now.isRebuilt === stop.isRebuilt &&
  now.eventId === stop.eventId &&
  (stop.isRebuilt || now.run === stop.run) &&
  rebaseConflictOf({ run: now.run })?.autoAgentId === null;

export const resolveRebaseMyself =
  ({ set, get }: SliceDeps) =>
  async ({ sessionId, mountId }: HistoryMountInput): Promise<RebaseStep | null> => {
    const stop = selectRebaseStop({ state: get(), sessionId, mountId });
    const conflict = rebaseConflictOf({ run: stop?.run });
    if (stop === null || conflict === null || conflict.autoAgentId !== null) {
      return null;
    }
    const target = historyTargetOf({ get, sessionId, mountId });
    const identity = identityOf({ target });
    const onto =
      conflict.ontoRef ??
      (
        await readRebasePlan({
          worktreePath: target.worktreePath,
          baseBranch: target.baseBranch,
          fetches: true,
        })
      ).ontoRef;
    const moved = identityChange({ get, sessionId, mountId, identity });
    if (moved !== null) {
      throw new Error(moved);
    }
    if (!isSameStop({ stop, now: selectRebaseStop({ state: get(), sessionId, mountId }) })) {
      throw new Error('This rebase stop changed while the base was read. Nothing was changed.');
    }
    const step = await worktreeStartRebase({
      worktreePath: target.worktreePath,
      onto,
      branch: target.branch,
    });
    set((state) => {
      const current = state.historyRuns[mountId];
      const base = current === undefined && stop.isRebuilt ? stop.run : current;
      if (base === undefined || base.rebaseConflict === undefined) {
        return {};
      }
      return {
        historyRuns: {
          ...state.historyRuns,
          [mountId]: {
            ...base,
            rebaseConflict: { ...base.rebaseConflict, ontoRef: onto, isHere: true },
            updatedAt: Date.now(),
          },
        },
      };
    });
    await refreshWorktreeStatuses({ worktreePaths: [target.worktreePath] });
    get().openMountTerminal(sessionId, target.worktreePath);
    return step;
  };
