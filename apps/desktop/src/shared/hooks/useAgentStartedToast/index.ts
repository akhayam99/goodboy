import { useCallback } from 'react';
import type { AgentId, SessionId } from '@goodboy/types';
import { useAppStore } from '../../../store';
import type { LensKind } from '../../../store';
import { useToast } from '../../../app/components/Toast';

type AnnounceParams = {
  readonly sessionId: SessionId;
  readonly agentId: AgentId | null;
  readonly title: string;
  readonly message: string;
  readonly actionLabel?: string;
  readonly lens?: LensKind;
};

export const useAgentStartedToast = (): ((params: AnnounceParams) => void) => {
  const setCurrentSession = useAppStore((s) => s.setCurrentSession);
  const setActiveLens = useAppStore((s) => s.setActiveLens);
  const selectAgent = useAppStore((s) => s.selectAgent);
  const { showToast } = useToast();
  return useCallback(
    ({
      sessionId,
      agentId,
      title,
      message,
      actionLabel = 'Open the agent',
      lens = 'agents',
    }: AnnounceParams) => {
      if (agentId == null) {
        return;
      }
      showToast('info', message, {
        title,
        action: {
          label: actionLabel,
          onClick: () => {
            void (async () => {
              await setCurrentSession(sessionId);
              setActiveLens(sessionId, lens);
              await selectAgent(sessionId, agentId);
            })();
          },
        },
      });
    },
    [selectAgent, setActiveLens, setCurrentSession, showToast],
  );
};
