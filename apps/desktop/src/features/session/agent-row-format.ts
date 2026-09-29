import type { TelemetryRecord } from '@goodboy/types';
import { formatUsd } from '@goodboy/ui';

export { formatTokens } from '@goodboy/ui';

export const formatCost = formatUsd;

export const computeLatestTelemetryByAgentId = (
  agentIds: ReadonlyArray<{ id: string; runId?: string }>,
  agentRunHistory: Readonly<Record<string, ReadonlyArray<string>>>,
  telemetryByRunId: ReadonlyMap<string, TelemetryRecord>,
): Map<string, TelemetryRecord> => {
  const result = new Map<string, TelemetryRecord>();
  for (const agent of agentIds) {
    const runIds = agentRunHistory[agent.id] ?? (agent.runId ? [agent.runId] : []);
    for (let i = runIds.length - 1; i >= 0; i--) {
      const rec = telemetryByRunId.get(runIds[i]!);
      if (rec) {
        result.set(agent.id, rec);
        break;
      }
    }
  }
  return result;
};
