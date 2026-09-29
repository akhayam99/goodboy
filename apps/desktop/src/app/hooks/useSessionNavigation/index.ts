import { useCallback, useMemo } from 'react';
import type { SessionId } from '@goodboy/types';
import {
  sessionPlace,
  useAppStore,
  useCurrentSession,
  useCurrentWorkspace,
  useSessions,
  useSortedGroupedSessions,
} from '../../../store';

type DeltaParams = {
  readonly delta: number;
};

export const useSessionNavigation = () => {
  const currentWorkspace = useCurrentWorkspace();
  const currentSession = useCurrentSession();
  const sessions = useSessions();
  const navigate = useAppStore((state) => state.navigate);
  const groups = useSortedGroupedSessions(currentWorkspace?.id ?? null, sessions);
  const order = useMemo(
    () => groups.flatMap((group) => group.sessions.map((session) => session.id as SessionId)),
    [groups],
  );

  return useCallback(
    ({ delta }: DeltaParams) => {
      if (order.length === 0) {
        return;
      }
      if (currentSession == null) {
        const target = delta >= 0 ? order[0] : order[order.length - 1];
        if (target !== undefined) {
          navigate({ to: sessionPlace({ sessionId: target }) });
        }
        return;
      }
      const index = order.indexOf(currentSession.id as SessionId);
      if (index === -1) {
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
