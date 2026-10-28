import { useState } from 'react';
import type { MountId, SessionId, WorktreeStatus } from '@goodboy/types';
import { useAppStore } from '../../../../store';
import { mainBehindOf } from '../../../../shared/lib/gitStatus';
import { isMountCompleted } from '../../../../store/slices/project-mounts/mountRowModel';
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
  const isDone = useAppStore((state) => mountId != null && isMountCompleted({ state, mountId }));
  const behindMain = mainBehindOf({ status, isDone });
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
    } catch (failure) {
      void reportError({ title: REBASE_FAILURE_TITLE, error: failure, sessionId });
    } finally {
      setIsStarting(false);
    }
  };

  return { canRebase, isRunning, run: start };
};
