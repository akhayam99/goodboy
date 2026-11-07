import { useMemo } from 'react';
import type { Agent, AgentId, SessionId, TelemetryRecord } from '@goodboy/types';
import { useAppStore } from '../../../../store';
import { agentSpendById } from '../../timeline/agentSpendById';
import { useSessionRunHistory } from '../useSessionRunHistory';

type Params = {
  readonly sessionId: SessionId;
  readonly agentId: AgentId;
};

const NO_AGENTS: ReadonlyArray<Agent> = [];
const NO_TELEMETRY: ReadonlyArray<TelemetryRecord> = [];

export const useAgentSpend = ({ sessionId, agentId }: Params): number => {
  const agents = useAppStore((state) => state.sessionPhaseRuns[sessionId] ?? NO_AGENTS);
  const telemetry = useAppStore((state) => state.sessionTelemetry[sessionId] ?? NO_TELEMETRY);
  const agentRunHistory = useSessionRunHistory({ sessionId });
  return useMemo(
    () => agentSpendById({ records: telemetry, agents, agentRunHistory }).get(agentId) ?? 0,
    [agentId, agentRunHistory, agents, telemetry],
  );
};
