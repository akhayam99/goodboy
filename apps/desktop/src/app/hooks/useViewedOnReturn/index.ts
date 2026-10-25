import { useEffect } from 'react';
import { isWindowInFront } from '../../../shared/lib/isWindowInFront';
import { useAppStore } from '../../../store';

export const useViewedOnReturn = (): void => {
  useEffect(() => {
    const stampOpenAgent = (): void => {
      if (!isWindowInFront()) {
        return;
      }
      const state = useAppStore.getState();
      const sessionId = state.currentSessionId;
      if (sessionId === null) {
        return;
      }
      const agentId = state.selectedAgentId[sessionId] ?? null;
      if (agentId === null) {
        return;
      }
      void state.markAgentSeen(sessionId, agentId);
    };
    window.addEventListener('focus', stampOpenAgent);
    document.addEventListener('visibilitychange', stampOpenAgent);
    return () => {
      window.removeEventListener('focus', stampOpenAgent);
      document.removeEventListener('visibilitychange', stampOpenAgent);
    };
  }, []);
};
