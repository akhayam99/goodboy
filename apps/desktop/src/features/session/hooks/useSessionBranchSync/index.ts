import { useEffect, useRef } from 'react';
import { useShallow } from 'zustand/react/shallow';
import type { Session, SessionId } from '@goodboy/types';
import { useAppStore, useSessionLastTurnFinishedAt } from '../../../../store';
import { resolveSessionRepo } from '../../../../store/slices/worktrees/resolveSessionRepo';
import { ensure, worktreeStatusKey } from '../useWorktreeStatuses/cache';
import { useIsBranchlessSession } from '../useIsBranchlessSession';

const BRANCH_MAX_AGE_MS = 10_000;

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
  const seenTurnRef = useRef<string | null | undefined>(undefined);

  useEffect(() => {
    if (!isActive || projectWorktreePath == null || isBranchless) return;
    const isNewTurn =
      seenTurnRef.current !== undefined && seenTurnRef.current !== lastTurnFinishedAt;
    seenTurnRef.current = lastTurnFinishedAt;
    let cancelled = false;
    ensure({
      key: worktreeStatusKey({ worktreePath: projectWorktreePath }),
      worktreePath: projectWorktreePath,
      maxAgeMs: isNewTurn ? 0 : BRANCH_MAX_AGE_MS,
    })
      .then((status) => {
        if (!cancelled && status?.branch) {
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
