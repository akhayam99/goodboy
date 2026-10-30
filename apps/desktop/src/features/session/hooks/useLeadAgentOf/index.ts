import { useCallback } from 'react';
import type { Agent, AgentId, SessionId } from '@goodboy/types';
import { useAppStore } from '../../../../store';

type Params = {
  readonly sessionId: SessionId;
};

type LeadParams = {
  readonly agentId: AgentId | null;
};

const NO_AGENTS: ReadonlyArray<Agent> = [];

export const useLeadAgentOf = ({ sessionId }: Params) => {
  const agents = useAppStore((state) => state.sessionPhaseRuns[sessionId] ?? NO_AGENTS);
  return useCallback(
    ({ agentId }: LeadParams): Agent | null =>
      agentId === null ? null : (agents.find((agent) => agent.id === agentId) ?? null),
    [agents],
  );
};
