import type { Agent, MountId, WorkflowRunId } from '@goodboy/types';

type Params = Readonly<{
  agents: ReadonlyArray<Agent>;
  workflowRunId: WorkflowRunId | null;
}>;

export const inheritedMountIdOf = ({ agents, workflowRunId }: Params): MountId | null => {
  if (workflowRunId === null) {
    return null;
  }
  const previous = agents
    .filter((agent) => agent.workflowRunId === workflowRunId && agent.mountId != null)
    .sort((left, right) => right.ordinal - left.ordinal)[0];
  return previous?.mountId ?? null;
};
