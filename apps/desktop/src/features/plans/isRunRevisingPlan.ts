import type { Agent, ArtifactId, SessionArtifact, WorkflowRun } from '@goodboy/types';
import { isRunHeldForPlan } from '../../store/slices/workflows/workflowPlanApproval';
import type { PlanRevising } from './planRevising';

type Params = {
  readonly run: WorkflowRun;
  readonly artifacts: ReadonlyArray<SessionArtifact>;
  readonly agents: ReadonlyArray<Agent>;
  readonly revising: ReadonlyMap<ArtifactId, PlanRevising>;
};

export const isRunRevisingPlan = ({ run, artifacts, agents, revising }: Params): boolean =>
  isRunHeldForPlan({ run }) &&
  artifacts.some(
    (artifact) =>
      revising.get(artifact.id)?.kind === 'revising' &&
      agents.some((agent) => agent.id === artifact.agentId && agent.workflowRunId === run.id),
  );
