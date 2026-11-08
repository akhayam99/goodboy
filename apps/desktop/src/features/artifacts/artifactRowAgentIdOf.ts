import type { AgentId, PlanWithCount, SessionArtifact } from '@goodboy/types';
import type { ArtifactListRow } from './artifactListRows';

type Params = {
  readonly row: ArtifactListRow;
  readonly plans: ReadonlyArray<PlanWithCount>;
  readonly artifacts: ReadonlyArray<SessionArtifact>;
};

export const artifactRowAgentIdOf = ({ row, plans, artifacts }: Params): AgentId | null => {
  if (row.target.kind === 'generation') {
    return row.target.generation.agentId;
  }
  const { artifactId } = row.target;
  return (
    plans.find((plan) => plan.id === artifactId)?.agentId ??
    artifacts.find((artifact) => artifact.id === artifactId)?.agentId ??
    null
  );
};
