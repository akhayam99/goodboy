import { useEffect, useRef } from 'react';
import { useAppStore } from '../../../../../store';

type Params = {
  readonly close: () => void;
};

export const useCloseOnRouteChange = ({ close }: Params): void => {
  const studio = useAppStore((state) => state.appStudio);
  const sessionId = useAppStore((state) => state.currentSessionId);
  const workspaceId = useAppStore((state) => state.currentWorkspaceId);
  const routeRef = useRef({ studio, sessionId, workspaceId });

  useEffect(() => {
    const route = routeRef.current;
    if (
      route.studio === studio &&
      route.sessionId === sessionId &&
      route.workspaceId === workspaceId
    ) {
      return;
    }
    routeRef.current = { studio, sessionId, workspaceId };
    close();
  }, [studio, sessionId, workspaceId, close]);
};
