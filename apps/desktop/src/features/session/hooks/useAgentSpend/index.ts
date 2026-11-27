import { useMemo } from 'react';
import type { Agent, AgentId, SessionId, TelemetryRecord } from '@goodboy/types';
import { useAppStore } from '../../../../store';
import { leadSpendOf, type LeadSpend } from '../../timeline/leadSpendOf';
import { useSessionRunHistory } from '../../../../shared/hooks/useSessionRunHistory';

type Params = {
  readonly sessionId: SessionId;
  readonly agentId: AgentId;
};

const NO_AGENTS: ReadonlyArray<Agent> = [];
const NO_TELEMETRY: ReadonlyArray<TelemetryRecord> = [];

export const useAgentSpend = ({ sessionId, agentId }: Params): LeadSpend => {
  const agents = useAppStore((state) => state.sessionPhaseRuns[sessionId] ?? NO_AGENTS);
  const telemetry = useAppStore((state) => state.sessionTelemetry[sessionId] ?? NO_TELEMETRY);
  const agentRunHistory = useSessionRunHistory({ sessionId });
  return useMemo(
    () => leadSpendOf({ records: telemetry, agents, agentRunHistory, agentId }),
    [agentId, agentRunHistory, agents, telemetry],
  );
};
