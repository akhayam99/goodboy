import { useMemo } from 'react';
import type { AgentId, SessionId } from '@goodboy/types';
import { useConversationAsks } from '../../../../../store/hooks/useConversationAsks';
import type { AskDock } from '../../../utils/conversationRows';

type Params = {
  readonly sessionId: SessionId;
  readonly agentId: AgentId | null;
  readonly isAskInDock: boolean;
  readonly isAskLapsed: boolean;
};

export const useAskDock = ({
  sessionId,
  agentId,
  isAskInDock,
  isAskLapsed,
}: Params): AskDock | null => {
  const { permissions } = useConversationAsks({ sessionId, agentId });
  return useMemo(
    () =>
      isAskInDock
        ? { openAskIds: new Set(permissions.map((ask) => ask.item.toolUseId)), isAskLapsed }
        : null,
    [isAskInDock, isAskLapsed, permissions],
  );
};
