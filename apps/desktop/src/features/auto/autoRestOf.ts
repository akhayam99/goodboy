import { AUTO_RESTING_PHASES, type AutoRestingPhase } from '@goodboy/db';
import type { AgentId, AutoTreeId } from '@goodboy/types';
import type { AutoTreeView } from '../../store/slices/auto-view/state';

export type AutoRest = Readonly<{
  treeId: AutoTreeId;
  phase: AutoRestingPhase;
}>;

type Params = {
  readonly views: ReadonlyArray<AutoTreeView>;
  readonly agentId: AgentId;
};

export const autoRestOf = ({ views, agentId }: Params): AutoRest | null => {
  const view = views.find((candidate) => candidate.tree.rootAgentId === agentId);
  if (view === undefined) {
    return null;
  }
  const { tree } = view;
  const phase = AUTO_RESTING_PHASES.find((resting) => resting === tree.phase);
  const isBusy =
    tree.stopState !== 'none' ||
    tree.activeRunId !== null ||
    view.delegations.some((delegation) => delegation.state !== 'settled');
  if (phase === undefined || isBusy) {
    return null;
  }
  return { treeId: tree.id, phase };
};
