import type { Agent } from '@goodboy/types';

type Params = {
  readonly focusedRunId: string | null;
  readonly selectedAgentId: string | null;
  readonly agents: ReadonlyArray<Agent>;
};

export const runOnScreenOf = ({ focusedRunId, selectedAgentId, agents }: Params): string | null => {
  if (focusedRunId !== null) {
    return focusedRunId;
  }
  const seen = new Set<string>();
  let current = agents.find((agent) => agent.id === selectedAgentId);
  while (current !== undefined && !seen.has(current.id)) {
    if (current.workflowRunId != null) {
      return current.workflowRunId;
    }
    seen.add(current.id);
    const parentId: string | null = current.parentAgentId ?? null;
    current = parentId === null ? undefined : agents.find((agent) => agent.id === parentId);
  }
  return null;
};
