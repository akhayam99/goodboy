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

const runOf = ({ runs, runId }: RunParams): WorkflowRun | null =>
  runId === null || runId === undefined
    ? null
    : (runs.find((candidate) => candidate.id === runId) ?? null);

export const presetRunFocusOf = ({
  lens,
  focusedRunId,
  selectedAgentId,
  runs,
  agents,
}: Params): PresetRunFocus | null => {
  if (selectedAgentId !== null) {
    const root = resolveRootAgent({ agents, agentId: selectedAgentId });
    const run = runOf({ runs, runId: root?.workflowRunId });
    if (run === null || (run.executionMode === 'dynamic' && root?.stepId == null)) {
      return null;
    }
    return { runId: run.id, agentId: selectedAgentId };
  }
  if (lens !== 'workflows') {
    return null;
  }
  const run = runOf({ runs, runId: focusedRunId });
  return run === null || run.executionMode === 'dynamic' ? null : { runId: run.id, agentId: null };
};
