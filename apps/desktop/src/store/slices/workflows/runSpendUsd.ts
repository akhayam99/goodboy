import type { Agent, AgentId, ProviderRunId, TelemetryRecord, WorkflowRunId } from '@goodboy/types';

type RunSpendParams = {
  readonly records: ReadonlyArray<TelemetryRecord>;
  readonly agents: ReadonlyArray<Agent>;
  readonly agentRunHistory: Readonly<Record<AgentId, ReadonlyArray<ProviderRunId>>>;
  readonly workflowRunId: WorkflowRunId;
};

export const runSpendUsd = ({
  records,
  agents,
  agentRunHistory,
  workflowRunId,
}: RunSpendParams): number => {
  const providerRunIds = new Set<ProviderRunId>();
  for (const agent of agents) {
    if (agent.workflowRunId !== workflowRunId) {
      continue;
    }
    if (agent.runId != null) {
      providerRunIds.add(agent.runId);
    }
    for (const runId of agentRunHistory[agent.id] ?? []) {
      providerRunIds.add(runId);
    }
  }
  let sum = 0;
  for (const record of records) {
    if (record.kind === 'summarizer' || !providerRunIds.has(record.runId)) {
      continue;
    }
    sum += record.estimatedCostUsd;
  }
  return sum;
};
