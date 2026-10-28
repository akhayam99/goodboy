import { hasWaveGroups, planClusterWaves } from '@goodboy/core/clusters';
import type { Agent, PlanWithCount } from '@goodboy/types';
import { waveLabel } from './waveLabel';

type Params = Readonly<{
  plans: ReadonlyArray<PlanWithCount>;
  agents: ReadonlyArray<Agent>;
}>;

export const waveLabelsOf = ({ plans, agents }: Params): ReadonlyMap<string, string> => {
  const labels = new Map<string, string>();
  for (const plan of plans) {
    const clusters = plan.clusters ?? [];
    const consumer = plan.lastConsumer ?? null;
    if (clusters.length < 2 || consumer === null || plan.consumptionCount === 0) {
      continue;
    }
    const wavePlan = planClusterWaves({ clusters });
    if (!hasWaveGroups({ plan: wavePlan })) {
      continue;
    }
    const children = agents
      .filter((agent) => agent.parentAgentId === consumer.agentId)
      .sort((left, right) => left.ordinal - right.ordinal);
    if (children.length !== clusters.length) {
      continue;
    }
    wavePlan.waves.forEach((indexes, index) => {
      for (const childIndex of indexes) {
        labels.set(children[childIndex]!.id, waveLabel({ index, size: indexes.length }));
      }
    });
  }
  return labels;
};
