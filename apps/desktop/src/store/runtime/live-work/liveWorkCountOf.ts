import type { ProviderRunId } from '@goodboy/types';
import type { LiveWorkState } from './selectLiveWork';
import { stopPlanOf } from './stopPlanOf';

type Params = Readonly<{
  state: LiveWorkState;
  keptRuns: ReadonlySet<ProviderRunId>;
}>;

export type LiveWorkCount = Readonly<{
  agents: number;
  runs: number;
}>;

export const liveWorkCountOf = ({ state, keptRuns }: Params): LiveWorkCount => {
  const plan = stopPlanOf({ state, scope: { kind: 'all' }, keptRuns });
  return {
    agents: plan.targets.length + plan.orphanRunIds.length + plan.startingAgentIds.length,
    runs: plan.decidingRuns.length,
  };
};
