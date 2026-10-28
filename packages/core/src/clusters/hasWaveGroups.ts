import type { ClusterWavePlan } from './planClusterWaves';

type Params = Readonly<{
  plan: ClusterWavePlan;
}>;

export const hasWaveGroups = ({ plan }: Params): boolean =>
  plan.waves.some((wave) => wave.length > 1) ||
  plan.shared.length > 0 ||
  plan.soloIndexes.length > 0 ||
  plan.issue !== null;
