import type { AgentId, SessionId } from '@goodboy/types';
import { EMPTY_ARRAY } from '../../../store';
import { useAgentMetrics } from '../../../features/session/hooks/useAgentMetrics';
import { AgentUsageFooter } from '../../../features/session/components/AgentDetailPane/AgentUsageFooter';

type Props = {
  readonly sessionId: SessionId;
  readonly agentId: AgentId;
};

export const TranscriptUsage = ({ sessionId, agentId }: Props) => {
  const metrics = useAgentMetrics({ sessionId });
  return (
    <AgentUsageFooter
      aggregate={metrics.aggregatesByAgentId.get(agentId) ?? null}
      contextUsage={metrics.providerUsageByAgentId.get(agentId) ?? EMPTY_ARRAY}
      turns={metrics.turnsByAgentId.get(agentId) ?? null}
    />
  );
};
