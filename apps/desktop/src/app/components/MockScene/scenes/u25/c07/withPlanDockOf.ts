import type { AutoDelegation } from '@goodboy/db';
import { brandId, type AgentId, type ArtifactId, type AutoDelegationId } from '@goodboy/types';
import type { AutoSceneData } from '../../u24/autoSceneSeed';

export type C07PlanDock = 'replanning' | 'failed' | 'v2';

type Params = {
  readonly scene: AutoSceneData;
  readonly dock: C07PlanDock;
};

const REPLANNER_ID = brandId<AgentId>({ value: 'mock-auto-replanner' });
const REPLANNER_DELEGATION = brandId<AutoDelegationId>({ value: 'mock-auto-delegation-replan' });
const PLAN_TWO_ID = brandId<ArtifactId>({ value: 'mock-auto-plan-ftue' });
const REPLAN_AFTER_MS = 60_000;
const WRITTEN_AFTER_MS = 240_000;

export const withPlanDockOf = ({ scene, dock }: Params): AutoSceneData => {
  const plan = scene.view.artifacts.find((row) => row.artifact.kind === 'plan');
  const planner = scene.view.delegations.find((delegation) => delegation.role === 'planner');
  const plannerAgent = scene.agents.find((agent) => agent.id === planner?.childAgentId);
  if (plan === undefined || planner === undefined || plannerAgent === undefined) {
    return scene;
  }
  const startedAt =
    Math.max(plan.updatedAt, planner.settledAt ?? planner.createdAt) + REPLAN_AFTER_MS;
  const owned = { ...plan, artifact: { ...plan.artifact, ownerDelegationId: planner.id } };
  const settledAt = startedAt + WRITTEN_AFTER_MS;
  const replanner: AutoDelegation = {
    ...planner,
    id: REPLANNER_DELEGATION,
    childAgentId: REPLANNER_ID,
    request: {
      task: 'New plan: FTUE home and discover',
      reason: 'You asked for the first run home and the discover page in one plan.',
    },
    reviseOf: null,
    baseRevision: null,
    createdAt: startedAt,
    state: dock === 'replanning' ? 'running' : 'settled',
    outcome: dock === 'replanning' ? null : dock === 'failed' ? 'failed' : 'completed',
    reason: dock === 'failed' ? 'lost_structure' : null,
    settledAt: dock === 'replanning' ? null : settledAt,
  };
  const planTwo = {
    ...plan,
    artifact: {
      ...plan.artifact,
      artifactId: PLAN_TWO_ID,
      ownerAgentId: REPLANNER_ID,
      ownerDelegationId: REPLANNER_DELEGATION,
      createdAt: settledAt,
    },
    title: 'FTUE home and discover',
    updatedAt: settledAt,
  };
  return {
    ...scene,
    view: {
      ...scene.view,
      delegations: [...scene.view.delegations, replanner],
      artifacts: [
        ...scene.view.artifacts.map((row) => (row === plan ? owned : row)),
        ...(dock === 'v2' ? [planTwo] : []),
      ],
    },
    agents: [...scene.agents, { ...plannerAgent, id: REPLANNER_ID, name: 'Planner' }],
  };
};
