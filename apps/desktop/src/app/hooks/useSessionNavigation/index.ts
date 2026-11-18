import { useCallback } from 'react';
import {
  sessionPlace,
  useAppStore,
  useCurrentSession,
  useCurrentWorkspace,
  useSessionOrder,
  useSessions,
} from '../../../store';

type DeltaParams = {
  readonly delta: number;
};

export const useSessionNavigation = () => {
  const currentWorkspace = useCurrentWorkspace();
  const currentSession = useCurrentSession();
  const sessions = useSessions();
  const navigate = useAppStore((state) => state.navigate);
  const { order } = useSessionOrder({ workspaceId: currentWorkspace?.id ?? null, sessions });

  return useCallback(
    ({ delta }: DeltaParams) => {
      if (order.length === 0) {
        return;
      }
      const index = currentSession == null ? -1 : order.indexOf(currentSession.id);
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
