import { useState } from 'react';
import type { AgentId, MountId, SessionId, WorktreeStatus } from '@goodboy/types';
import { useAppStore } from '../../../../store';
import { distanceBehind } from '../../../../shared/lib/gitStatus';
import { useToast } from '../../../../shared/components/Toast';
import { isHistoryRunActive } from '../../../../store/slices/history/isHistoryRunActive';
import { resolveMountBaseBranch } from '../../../../store/slices/project-mounts/selectors';

type Params = {
  readonly sessionId: SessionId | null;
  readonly mountId?: MountId | null;
  readonly status: WorktreeStatus | null;
};

type RunParams = {
  readonly mountId: MountId;
  readonly behind?: number;
};

type Result = {
  readonly canRebase: boolean;
  readonly isRunning: boolean;
  readonly rewriterId: AgentId | null;
  readonly run: (params: RunParams) => Promise<void>;
};

export const REBASE_FAILURE_TITLE = "Couldn't rebase the branch";

export const useRebaseBranch = ({ sessionId, mountId, status }: Params): Result => {
  const [isStarting, setIsStarting] = useState(false);
  const run = useAppStore((state) =>
    mountId == null ? null : (state.historyRuns[mountId] ?? null),
  );
  const rebaseBranch = useAppStore((state) => state.rebaseBranch);
  const reportError = useAppStore((state) => state.reportError);
  const { showToast } = useToast();
  const baseBranch = useAppStore((state) => {
    if (sessionId == null || mountId == null) {
      return null;
    }
    const mount =
      state.sessionProjectMounts[sessionId]?.find((candidate) => candidate.mountId === mountId) ??
      null;
    return resolveMountBaseBranch({ mount, projects: state.projects });
  });
  const isRebaseRun = run !== null && run.origin === 'rebase';
  const isRunning = isStarting || (isRebaseRun && isHistoryRunActive({ phase: run.phase }));
  const rewriterId = isRebaseRun && run.phase === 'rewriting' ? run.agentId : null;
  const behindMain = status != null ? distanceBehind({ distance: status.mainDistance }) : null;
  const canRebase = sessionId != null && behindMain != null && behindMain > 0;

  const start = async ({ mountId: targetMountId, behind }: RunParams): Promise<void> => {
    const runBehind = behind ?? behindMain;
    if (sessionId == null || runBehind == null || runBehind <= 0 || isRunning) {
      return;
    }
    setIsStarting(true);
    try {
      const outcome = await rebaseBranch({ sessionId, mountId: targetMountId });
      if (outcome === 'rebased') {
        showToast({
          kind: 'success',
          title: 'Rebase done',
          message: `This branch is rebased on ${baseBranch ?? 'its base branch'}. A backup of the old history stays here.`,
        });
        return;
      }
      if (outcome === 'rewriting') {
        showToast({
          kind: 'info',
          title: 'Rebase needs a merge',
          message:
            'History rewriter is merging a conflict in a copy. Your branch moves only when the result checks out.',
        });
      }
    } catch (failure) {
      void reportError({ title: REBASE_FAILURE_TITLE, error: failure, sessionId });
    } finally {
      setIsStarting(false);
    }
  };

  return { canRebase, isRunning, rewriterId, run: start };
};
