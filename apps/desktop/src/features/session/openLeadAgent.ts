import type { AgentId, SessionId } from '@goodboy/types';
import { agentPlace } from '../../store/slices/navigation/place';
import type { NavigateParams } from '../../store/slices/navigation/types';
import { useLeadSelectionStore } from './hooks/useLeadSelectionStore';

type Params = {
  readonly navigate: (params: NavigateParams) => void;
  readonly sessionId: SessionId;
  readonly leadAgentId: AgentId;
  readonly agentId: AgentId;
};

export const openLeadAgent = ({ navigate, sessionId, leadAgentId, agentId }: Params): void => {
  useLeadSelectionStore.getState().select({ leadAgentId, agentId });
  navigate({ to: agentPlace({ sessionId, agentId: leadAgentId }) });
};
