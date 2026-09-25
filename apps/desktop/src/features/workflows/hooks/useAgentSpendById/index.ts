import { useMemo } from 'react';
import { useShallow } from 'zustand/react/shallow';
import type { Agent, AgentId, ProviderRunId, SessionId, TelemetryRecord } from '@goodboy/types';
import { EMPTY_ARRAY, useAppStore } from '../../../../store';
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
  const agentRunHistory = useAppStore(
    useShallow((state) => {
      const history: Record<string, ReadonlyArray<ProviderRunId>> = {};
      for (const agent of state.sessionPhaseRuns[sessionId] ??
        (EMPTY_ARRAY as ReadonlyArray<Agent>)) {
        const runIds = state.agentRunHistory[agent.id];
        if (runIds != null) {
          history[agent.id] = runIds;
        }
      }
      return history;
    }),
  );
  return useMemo(
    () => agentSpendById({ records: telemetry, agents, agentRunHistory }),
    [agentRunHistory, agents, telemetry],
  );
};
