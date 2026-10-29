import type { Agent } from '@goodboy/types';

type Params = {
  readonly agent: Agent | undefined;
  readonly isAsking: boolean;
  readonly isMissingArtifact: boolean;
  readonly silentEndMark: string | undefined;
};

export const stepEndedWithoutResult = ({
  agent,
  isAsking,
  isMissingArtifact,
  silentEndMark,
}: Params): boolean =>
  agent !== undefined &&
  agent.stepId != null &&
  agent.workflowRunId != null &&
  agent.status === 'blocked' &&
  silentEndMark !== undefined &&
  agent.completedAt === silentEndMark &&
  !isAsking &&
  !isMissingArtifact;
