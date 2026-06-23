import { useMemo } from 'react';
import type { AgentId, SessionId } from '@goodboy/types';
import { useAppStore } from '../../../../store';
import { openUrl } from '../../../../shared/lib/editor';

export type RunsNavigation = {
  readonly openAgentFromRun: (sessionId: SessionId, agentId: AgentId) => void;
  readonly jumpToComment: (url: string) => void;
};

export const useRunsNavigation = (requestClose: () => void): RunsNavigation => {
  const setCurrentSession = useAppStore((s) => s.setCurrentSession);
  const selectAgent = useAppStore((s) => s.selectAgent);

  return useMemo<RunsNavigation>(() => {
    const openAgentFromRun = (sessionId: SessionId, agentId: AgentId): void => {
      void setCurrentSession(sessionId).then(() => {
        void selectAgent(sessionId, agentId);
        window.dispatchEvent(new CustomEvent('goodboy:reveal-chat'));
        requestClose();
      });
    };

    const jumpToComment = (url: string): void => {
      if (url.length === 0) {
        return;
      }
      void openUrl(url);
    };

    return { openAgentFromRun, jumpToComment };
  }, [setCurrentSession, selectAgent, requestClose]);
};
