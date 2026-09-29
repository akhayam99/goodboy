import { useCallback, useMemo } from 'react';
import type { SessionId } from '@goodboy/types';
import {
  sessionPlace,
  useAppStore,
  useCurrentSession,
  useCurrentWorkspace,
  useSessionViewPrefs,
  useSessions,
  useSortedGroupedSessions,
} from '../../../store';
import { isSessionGroupCollapsed } from '../../../store/slices/session-view/isSessionGroupCollapsed';

type DeltaParams = {
  readonly delta: number;
};

export const useSessionNavigation = () => {
  const currentWorkspace = useCurrentWorkspace();
  const currentSession = useCurrentSession();
  const sessions = useSessions();
  const navigate = useAppStore((state) => state.navigate);
  const workspaceId = currentWorkspace?.id ?? null;
  const groups = useSortedGroupedSessions(workspaceId, sessions);
  const isGrouped = useSessionViewPrefs(workspaceId).group !== 'none';
  const groupExpanded = useAppStore((state) => state.sessionGroupExpanded);
  const order = useMemo(
    () =>
      groups
        .filter(
          (group) =>
            !isGrouped || !isSessionGroupCollapsed({ key: group.key, overrides: groupExpanded }),
        )
        .flatMap((group) => group.sessions.map((session) => session.id as SessionId)),
    [groups, isGrouped, groupExpanded],
  );

  return useCallback(
    ({ delta }: DeltaParams) => {
      if (order.length === 0) {
        return;
      }
      const index = currentSession == null ? -1 : order.indexOf(currentSession.id as SessionId);
      if (index === -1) {
        const target = delta >= 0 ? order[0] : order[order.length - 1];
        if (target !== undefined) {
          navigate({ to: sessionPlace({ sessionId: target }) });
        }
        return;
      }
      const next = order[index + delta];
      if (next !== undefined) {
        navigate({ to: sessionPlace({ sessionId: next }) });
      }
    },
    [order, currentSession, navigate],
  );
};
