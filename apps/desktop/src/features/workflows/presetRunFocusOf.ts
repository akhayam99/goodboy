import type { Agent, AgentId, WorkflowRun, WorkflowRunId } from '@goodboy/types';
import { resolveRootAgent } from '../session/agent-kind';

export type PresetRunFocus = {
  readonly runId: WorkflowRunId;
  readonly agentId: AgentId | null;
};

type Params = {
  readonly lens: string | null;
  readonly focusedRunId: string | null;
  readonly selectedAgentId: AgentId | null;
  readonly runs: ReadonlyArray<WorkflowRun>;
  readonly agents: ReadonlyArray<Agent>;
};

type RunParams = {
  readonly runs: ReadonlyArray<WorkflowRun>;
  readonly runId: string | null | undefined;
};

const presetRunOf = ({ runs, runId }: RunParams): WorkflowRun | null => {
  if (runId === null || runId === undefined) {
    return null;
  }
  const run = runs.find((candidate) => candidate.id === runId) ?? null;
  if (run === null || run.executionMode === 'dynamic') {
    return null;
  }
  return run;
};

export const presetRunFocusOf = ({
  lens,
  focusedRunId,
  selectedAgentId,
  runs,
  agents,
}: Params): PresetRunFocus | null => {
  if (selectedAgentId !== null) {
    const root = resolveRootAgent({ agents, agentId: selectedAgentId });
    const run = presetRunOf({ runs, runId: root?.workflowRunId });
    if (run !== null) {
      return { runId: run.id, agentId: selectedAgentId };
    }
    return null;
  }
  if (lens !== 'workflows') {
    return null;
  }
  const run = presetRunOf({ runs, runId: focusedRunId });
  return run === null ? null : { runId: run.id, agentId: null };
};
