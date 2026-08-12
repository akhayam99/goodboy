import { useEffect, useMemo } from 'react';
import { useShallow } from 'zustand/react/shallow';
import type { Session, SessionId } from '@goodboy/types';
import { useAppStore, useFilesTouched } from '../../../../store';
import { resolveSessionRepo } from '../../../../store/slices/worktrees/resolveSessionRepo';
import { worktreeStatus } from '../../../worktree/worktree';
import { useIsBranchlessSession } from '../useIsBranchlessSession';

type Params = {
  readonly session: Session;
  readonly isActive: boolean;
};

type Diffstat = {
  readonly additions: number;
  readonly deletions: number;
};

type LensNavModel = {
  readonly isBranchless: boolean;
  readonly filesCount: number;
  readonly diffstat: Diffstat;
};

export const useLensNavModel = ({ session, isActive }: Params): LensNavModel => {
  const sessionId = session.id as SessionId;
  const isBranchless = useIsBranchlessSession({ session });
  const sessionRepo = useAppStore(useShallow((state) => resolveSessionRepo({ state, sessionId })));
  const projectWorktreePath = sessionRepo?.worktreePath ?? null;
  const reconcileSessionBranch = useAppStore((s) => s.reconcileSessionBranch);
  const filesTouched = useFilesTouched(sessionId, isActive && !isBranchless);

  useEffect(() => {
    if (!isActive || projectWorktreePath == null || isBranchless) return;
    let cancelled = false;
    worktreeStatus(projectWorktreePath)
      .then((status) => {
        if (!cancelled && status.branch) {
          void reconcileSessionBranch(sessionId, status.branch);
        }
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [
    filesTouched.count,
    isActive,
    isBranchless,
    projectWorktreePath,
    reconcileSessionBranch,
    sessionId,
  ]);

  return useMemo(
    () => ({
      isBranchless,
      filesCount: filesTouched.count,
      diffstat: { additions: filesTouched.additions, deletions: filesTouched.deletions },
    }),
    [isBranchless, filesTouched.count, filesTouched.additions, filesTouched.deletions],
  );
};
