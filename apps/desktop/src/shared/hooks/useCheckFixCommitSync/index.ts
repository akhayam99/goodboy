import { useEffect, useMemo } from 'react';
import { useShallow } from 'zustand/react/shallow';
import type { AgentId, MountId, SessionId, WorktreeStatus } from '@goodboy/types';
import { useAppStore } from '../../../store';
import { resolveSessionRepo } from '../../../store/slices/worktrees/resolveSessionRepo';
import { useWorktreeStatuses } from '../../../features/session/hooks/useWorktreeStatuses';

export type CheckFixTarget = {
  readonly mountId: MountId;
  readonly fixAgentId: AgentId;
};

type Params = {
  readonly sessionId: SessionId;
  readonly targets: ReadonlyArray<CheckFixTarget>;
};

type SignatureParams = {
  readonly status: WorktreeStatus | undefined;
};

const signatureOf = ({ status }: SignatureParams): string =>
  status === undefined
    ? 'unread'
    : `${status.head ?? ''}|${JSON.stringify(status.upstreamDistance)}`;

export const useCheckFixCommitSync = ({ sessionId, targets }: Params): void => {
  const readCheckFixCommit = useAppStore((state) => state.readCheckFixCommit);
  const worktreePaths = useAppStore(
    useShallow((state) =>
      targets.map(
        ({ mountId }) => resolveSessionRepo({ state, sessionId, mountId })?.worktreePath ?? '',
      ),
    ),
  );
  const statusTargets = useMemo(
    () => worktreePaths.filter((path) => path !== '').map((worktreePath) => ({ worktreePath })),
    [worktreePaths],
  );
  const statuses = useWorktreeStatuses({ targets: statusTargets });
  const signature = worktreePaths.map((path) => signatureOf({ status: statuses.get(path) })).join();
  useEffect(() => {
    for (const { mountId, fixAgentId } of targets) {
      void readCheckFixCommit({ sessionId, mountId, fixAgentId });
    }
  }, [readCheckFixCommit, sessionId, targets, signature]);
};
