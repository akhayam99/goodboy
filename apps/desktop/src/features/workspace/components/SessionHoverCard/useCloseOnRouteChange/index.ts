import { useEffect, useRef } from 'react';
import { useAppStore } from '../../../../../store';

type Params = {
  readonly close: () => void;
};

export const useCloseOnRouteChange = ({ close }: Params): void => {
  const studio = useAppStore((state) => state.appStudio);
  const sessionId = useAppStore((state) => state.currentSessionId);
  const workspaceId = useAppStore((state) => state.currentWorkspaceId);
  const draftWorkspaceId = useAppStore((state) => state.openSessionDraftWorkspaceId);
  const routeRef = useRef({ studio, sessionId, workspaceId, draftWorkspaceId });

  useEffect(() => {
    const route = routeRef.current;
    if (
      route.studio === studio &&
      route.sessionId === sessionId &&
      route.workspaceId === workspaceId &&
      route.draftWorkspaceId === draftWorkspaceId
    ) {
      return;
    }
    routeRef.current = { studio, sessionId, workspaceId, draftWorkspaceId };
    close();
  }, [studio, sessionId, workspaceId, draftWorkspaceId, close]);
};
