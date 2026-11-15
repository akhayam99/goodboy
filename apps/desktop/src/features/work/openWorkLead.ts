import type { AgentId, SessionId } from '@goodboy/types';
import { agentPlace, useAppStore } from '../../store';

type Params = {
  readonly sessionId: SessionId;
  readonly agentId: AgentId;
};

export const openWorkLead = ({ sessionId, agentId }: Params): void => {
  useAppStore.getState().navigate({ to: agentPlace({ sessionId, agentId }) });
};
