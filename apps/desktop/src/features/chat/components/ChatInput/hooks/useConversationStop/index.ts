import type { AgentId, SessionId } from '@goodboy/types';
import { useAgentStop } from '../../../../../../shared/hooks/useAgentStop';
import type { ConversationStop } from '../../../../../../shared/types/conversationStop';
import { useAppStore } from '../../../../../../store';
import type { ConversationDockSlots } from '../../../ConversationDock/conversationDockSlots';
import { conversationStopOf } from '../../../ConversationDock/conversationStopOf';
import { useEscapeStop } from '../useEscapeStop';

type Params = {
  readonly sessionId: SessionId;
  readonly agentId: AgentId | null;
  readonly dock: ConversationDockSlots | undefined;
  readonly isRunning: boolean;
};

type Result = Readonly<{
  stop: ConversationStop | null;
  isArmed: boolean;
  onEscape: () => boolean;
}>;

export const useConversationStop = ({ sessionId, agentId, dock, isRunning }: Params): Result => {
  const agentStop = useAgentStop({ sessionId, agentId });
  const stop = conversationStopOf({
    agentStop,
    scoped: dock?.stop ?? null,
    stopLabel: dock?.stopLabel ?? null,
    isRunning,
    sentence: dock?.liveSentence ?? null,
  });
  const isCovered = useAppStore((state) => state.drawer !== null);
  const { isArmed, onEscape } = useEscapeStop({ stop, isCovered });
  return { stop, isArmed, onEscape };
};
