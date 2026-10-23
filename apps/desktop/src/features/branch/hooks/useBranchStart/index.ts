import { useMemo } from 'react';
import type { MountId, SessionId, WorktreeStatus } from '@goodboy/types';
import { useAppStore } from '../../../../store';
import { useNow } from '../../../../shared/hooks/useNow';
import { selectMountBaseBranch } from '../../../../store/slices/project-mounts/selectors';
import { rebaseConflictOf } from '../../../history/rebaseConflictOf';
import { branchNextStepOf, type BranchNextStep } from '../../branchNextStepOf';
import { branchStartLineOf, type BranchStartLine } from '../../branchStartLineOf';
import { branchStartCellsOf } from '../../components/PullRequestTab/branchStartCellsOf';
import type { StatusCell } from '../../components/PullRequestTab/statusCell';

type Params = {
  readonly sessionId: SessionId;
  readonly mountId: MountId | null;
  readonly mountPath: string | null;
  readonly status: WorktreeStatus | null;
};

export type BranchStart = {
  readonly step: BranchNextStep;
  readonly line: BranchStartLine;
  readonly cells: ReadonlyArray<StatusCell>;
  readonly conflictFiles: ReadonlyArray<string>;
  readonly baseBranch: string;
};

const NO_FILES: ReadonlyArray<string> = [];

export const useBranchStart = ({ sessionId, mountId, mountPath, status }: Params): BranchStart => {
  const baseBranch = useAppStore(
    (state) => selectMountBaseBranch({ state, sessionId, path: mountPath }) ?? 'main',
  );
  const conflictFiles = useAppStore((state) => {
    const conflict = rebaseConflictOf({
      run: mountId === null ? null : state.historyRuns[mountId],
    });
    return conflict === null ? null : conflict.files;
  });
  const hasConflictStop = conflictFiles !== null;
  const localCheck = useAppStore((state) =>
    mountId === null ? null : (state.mountLocalChecks[mountId] ?? null),
  );
  const now = useNow(60_000);
  return useMemo(() => {
    const step = branchNextStepOf({ status, hasConflictStop });
    const files = conflictFiles ?? NO_FILES;
    const unmerged =
      status !== null && status.workingTree.kind === 'known' ? status.workingTree.unmerged : 0;
    return {
      step,
      line: branchStartLineOf({ step, baseBranch }),
      cells: branchStartCellsOf({
        step,
        baseBranch,
        conflictCount: files.length > 0 ? files.length : unmerged,
        localCheck,
        now,
      }),
      conflictFiles: files,
      baseBranch,
    };
  }, [baseBranch, conflictFiles, hasConflictStop, localCheck, now, status]);
};
