import { useMemo } from 'react';
import type { Agent, ProviderRunId, TelemetryRecord } from '@goodboy/types';
import { useAppStore } from '../../../store';
import {
  executedAgentRouting,
  type ExecutedAgentRouting,
} from '../../../store/slices/turn/executedAgentRouting';

type Params = {
  readonly agent: Agent | null;
};

const NO_RECORDS: ReadonlyArray<TelemetryRecord> = [];
const NO_RUN_IDS: ReadonlyArray<ProviderRunId> = [];
const NO_ROUTING: Readonly<Record<ProviderRunId, ExecutedAgentRouting>> = {};

export const useExecutedRoutingOf = ({ agent }: Params): ExecutedAgentRouting | null => {
  const records = useAppStore((state) =>
    agent === null ? NO_RECORDS : (state.sessionTelemetry[agent.sessionId] ?? NO_RECORDS),
  );
  const runHistory = useAppStore((state) =>
    agent === null ? NO_RUN_IDS : (state.agentRunHistory[agent.id] ?? NO_RUN_IDS),
  );
  const liveRouting = useAppStore((state) =>
    agent === null ? NO_ROUTING : (state.runRouting[agent.id] ?? NO_ROUTING),
  );
  const agentRunId = agent?.runId ?? null;
  return useMemo(
    () =>
      agent === null
        ? null
        : executedAgentRouting({ agentRunId, runHistory, records, liveRouting }),
    [agent, agentRunId, runHistory, records, liveRouting],
  );
};
