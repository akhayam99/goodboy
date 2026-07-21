import type { TelemetryRecord } from '@goodboy/types';
import { getModelDescriptor } from '@goodboy/core';
import { formatUsd } from '@goodboy/ui';

export { formatTokens } from '@goodboy/ui';

export const formatCost = formatUsd;

export const shortModel = (model: string): string => {
  const m = model.match(/claude-(haiku|sonnet|opus|fable)/i);
  if (m && m[1]) {
    return m[1].toLowerCase();
  }
  return getModelDescriptor(model)?.label ?? model;
};

export const shortModelWithVersion = (model: string): string => {
  const m = model.match(/claude-(haiku|sonnet|opus|fable)-(\d+)(?:-(\d+))?/i);
  if (m && m[1] && m[2]) {
    return `${m[1].toLowerCase()} ${m[2]}${m[3] ? `.${m[3]}` : ''}`;
  }
  return shortModel(model);
};

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
