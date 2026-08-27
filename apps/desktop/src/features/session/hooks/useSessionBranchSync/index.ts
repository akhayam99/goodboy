import { useEffect } from 'react';
import { useShallow } from 'zustand/react/shallow';
import type { Session, SessionId } from '@goodboy/types';
import { useAppStore, useSessionLastTurnFinishedAt } from '../../../../store';
import { resolveSessionRepo } from '../../../../store/slices/worktrees/resolveSessionRepo';
import { worktreeStatus } from '../../../worktree/worktree';
import { useIsBranchlessSession } from '../useIsBranchlessSession';

type Params = {
  readonly session: Session;
  readonly isActive: boolean;
};

export const useSessionBranchSync = ({ session, isActive }: Params): void => {
  const sessionId = session.id as SessionId;
  const isBranchless = useIsBranchlessSession({ session });
  const sessionRepo = useAppStore(useShallow((state) => resolveSessionRepo({ state, sessionId })));
  const projectWorktreePath = sessionRepo?.worktreePath ?? null;
  const reconcileSessionBranch = useAppStore((s) => s.reconcileSessionBranch);
  const lastTurnFinishedAt = useSessionLastTurnFinishedAt(sessionId);

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
    isActive,
    isBranchless,
    lastTurnFinishedAt,
    projectWorktreePath,
    reconcileSessionBranch,
    sessionId,
  ]);
};
