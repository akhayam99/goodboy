import { useMemo } from 'react';
import type { Agent, AgentId, SessionId, TelemetryRecord } from '@goodboy/types';
import { EMPTY_ARRAY, useAppStore } from '../../../../store';
import { useSessionRunHistory } from '../../../../shared/hooks/useSessionRunHistory';
import { agentSpendById } from '../../../session/timeline/agentSpendById';

type Params = {
  readonly sessionId: SessionId;
};

export const useAgentSpendById = ({ sessionId }: Params): ReadonlyMap<AgentId, number> => {
  const agents = useAppStore(
    (state) => state.sessionPhaseRuns[sessionId] ?? (EMPTY_ARRAY as ReadonlyArray<Agent>),
  );
  const telemetry = useAppStore(
    (state) => state.sessionTelemetry[sessionId] ?? (EMPTY_ARRAY as ReadonlyArray<TelemetryRecord>),
  );
  const agentRunHistory = useSessionRunHistory({ sessionId });
  return useMemo(
    () => agentSpendById({ records: telemetry, agents, agentRunHistory }),
    [agentRunHistory, agents, telemetry],
  );
};
