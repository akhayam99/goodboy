import { useMemo } from 'react';
import type { MountId, SessionId, WorktreeStatus } from '@goodboy/types';
import { useAppStore } from '../../../../store';
import { useNow } from '../../../../shared/hooks/useNow';
import { isMountRequestMerged } from '../../../../store/slices/project-mounts/mountRowModel';
import { selectMountBaseBranch } from '../../../../store/slices/project-mounts/selectors';
import { rebaseConflictOf } from '../../../history/rebaseConflictOf';
import { branchNextStepOf, type BranchNextStep } from '../../branchNextStepOf';
import { branchStartLineOf, type BranchStartLine } from '../../branchStartLineOf';

type Params = {
  readonly sessionId: SessionId;
  readonly mountId: MountId | null;
  readonly mountPath: string | null;
  readonly status: WorktreeStatus | null;
};

export type BranchStart = {
  readonly step: BranchNextStep;
  readonly line: BranchStartLine;
  readonly conflictFiles: ReadonlyArray<string>;
  readonly baseBranch: string;
  readonly configuredBase: string | null;
};

const NO_FILES: ReadonlyArray<string> = [];

export const useBranchStart = ({ sessionId, mountId, mountPath, status }: Params): BranchStart => {
  const configuredBase = useAppStore((state) =>
    selectMountBaseBranch({ state, sessionId, path: mountPath }),
  );
  const baseBranch = configuredBase ?? 'main';
  const conflictFiles = useAppStore((state) => {
    const conflict = rebaseConflictOf({
      run: mountId === null ? null : state.historyRuns[mountId],
    });
    return conflict === null ? null : conflict.files;
  });
  const hasConflictStop = conflictFiles !== null;
  const isDone = useAppStore(
    (state) => mountId !== null && isMountRequestMerged({ state, mountId }),
  );
  const localCheck = useAppStore((state) =>
    mountId === null ? null : (state.mountLocalChecks[mountId] ?? null),
  );
  const now = useNow(60_000);
  return useMemo(() => {
    const step = branchNextStepOf({ status, hasConflictStop, isDone });
    const files = isDone ? NO_FILES : (conflictFiles ?? NO_FILES);
    return {
      step,
      line: branchStartLineOf({ step, baseBranch, localCheck, now }),
      conflictFiles: files,
      baseBranch,
      configuredBase,
    };
  }, [baseBranch, configuredBase, conflictFiles, hasConflictStop, isDone, localCheck, now, status]);
};
