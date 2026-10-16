import type { Agent, AgentId, PlanWithCount, SessionArtifact } from '@goodboy/types';
import { isPendingGeneration } from './artifactCollection';

type Params = Readonly<{
  plans: ReadonlyArray<PlanWithCount>;
  artifacts: ReadonlyArray<SessionArtifact>;
  agents: ReadonlyArray<Agent>;
}>;

export const liveArtifactCountOf = ({ plans, artifacts, agents }: Params): number => {
  const produced: ReadonlySet<AgentId> = new Set(artifacts.map((artifact) => artifact.agentId));
  const generations = agents.filter((agent) => isPendingGeneration({ agent, produced })).length;
  const planStatus = new Map<string, string>(
    artifacts
      .filter((artifact) => artifact.kind === 'plan')
      .map((artifact) => [artifact.id, artifact.status]),
  );
  plans.forEach((plan) => planStatus.set(plan.id, plan.status));
  const livePlans = [...planStatus.values()].filter((status) => status !== 'discarded').length;
  const documents = artifacts.filter(
    (artifact) => artifact.kind !== 'plan' && artifact.status !== 'discarded',
  ).length;
  return generations + livePlans + documents;
};
