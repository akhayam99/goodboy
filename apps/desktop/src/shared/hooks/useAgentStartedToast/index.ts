import { useCallback } from 'react';
import type { AgentId, SessionId } from '@goodboy/types';
import { useAppStore, agentPlace } from '../../../store';
import { useToast } from '../../../app/components/Toast';

type AnnounceParams = {
  readonly sessionId: SessionId;
  readonly agentId: AgentId | null;
  readonly title: string;
  readonly message: string;
  readonly actionLabel?: string;
  readonly onOpen?: () => void;
};

export const useAgentStartedToast = (): ((params: AnnounceParams) => void) => {
  const navigate = useAppStore((s) => s.navigate);
  const { showToast } = useToast();
  return useCallback(
    ({
      sessionId,
      agentId,
      title,
      message,
      actionLabel = 'Open the agent',
      onOpen,
    }: AnnounceParams) => {
      if (agentId == null) {
        return;
      }
      showToast({
        kind: 'info',
        message,
        title,
        action: {
          label: actionLabel,
          onClick: () => {
            void (async () => {
              navigate({ to: agentPlace({ sessionId, agentId }) });
              onOpen?.();
            })();
          },
        },
      });
    },
    [navigate, showToast],
  );
};
