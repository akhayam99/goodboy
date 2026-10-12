import { useEffect, useRef } from 'react';
import { useShallow } from 'zustand/react/shallow';
import type { Session, SessionId } from '@goodboy/types';
import { useAppStore, useSessionLastTurnFinishedAt } from '../../../../store';
import { resolveSessionRepo } from '../../../../store/slices/worktrees/resolveSessionRepo';
import {
  clearOnlyOnline,
  loadOnlyOnline,
} from '../../../../store/slices/worktreeStatuses/onlyOnline';
import { ensure, worktreeStatusKey } from '../../../../store/slices/worktreeStatuses/cache';
import { distanceBehind } from '../../../../shared/lib/gitStatus';
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
  const projectMountId = sessionRepo?.mountId ?? null;
  const projectId = sessionRepo?.projectId ?? null;
  const workspaceId = session.workspaceId;
  const reconcileSessionBranch = useAppStore((s) => s.reconcileSessionBranch);
  const reportError = useAppStore((s) => s.reportError);
  const lastTurnFinishedAt = useSessionLastTurnFinishedAt(sessionId);
  const seenTurnRef = useRef<string | null | undefined>(undefined);

  useEffect(() => {
    if (!isActive || projectWorktreePath === null || projectMountId === null || isBranchless) {
      return;
    }
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
        const observedBranch = status?.branch ?? null;
        if (cancelled || observedBranch === null || observedBranch === '') {
          return;
        }
        void reconcileSessionBranch({
          sessionId,
          mountId: projectMountId,
          worktreePath: projectWorktreePath,
          observedBranch,
        });
        if (status === null) {
          return;
        }
        if ((distanceBehind({ distance: status.upstreamDistance }) ?? 0) === 0) {
          clearOnlyOnline({ mountId: projectMountId });
          return;
        }
        void loadOnlyOnline({
          mountId: projectMountId,
          worktreePath: projectWorktreePath,
          branch: observedBranch,
          workspaceId,
          projectId,
        }).catch((error: unknown) =>
          reportError({
            title: "Couldn't check the online copy",
            error,
            severity: 'warning',
            sessionId,
            coalesceKey: `online-copy:${projectMountId}`,
          }),
        );
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [
    isActive,
    isBranchless,
    lastTurnFinishedAt,
    projectId,
    projectMountId,
    projectWorktreePath,
    reconcileSessionBranch,
    reportError,
    sessionId,
    workspaceId,
  ]);
};
