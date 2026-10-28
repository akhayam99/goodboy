import type { Agent } from '@goodboy/types';

type Params = {
  readonly agent: Agent | undefined;
  readonly isAsking: boolean;
  readonly isMissingArtifact: boolean;
};

export const stepEndedWithoutResult = ({ agent, isAsking, isMissingArtifact }: Params): boolean =>
  agent !== undefined &&
  agent.stepId != null &&
  agent.workflowRunId != null &&
  agent.status === 'blocked' &&
  !isAsking &&
  !isMissingArtifact;
