import type { AutoDelegation, AutoTree } from '@goodboy/db';
import type { MountId, SessionId } from '@goodboy/types';
import type { AppState } from '../../types';
import { textFieldOf } from '../../../shared/utils/textFieldOf';

type TreeFact = {
  readonly tree: Pick<AutoTree, 'phase' | 'stopState' | 'primaryMountId'>;
  readonly delegations: ReadonlyArray<Pick<AutoDelegation, 'target'>>;
};

type Params = {
  readonly state: Pick<AppState, 'sessionPhaseRuns' | 'agentTurnDestination'> & {
    readonly autoTreeViews: Readonly<Record<string, ReadonlyArray<TreeFact>>>;
  };
  readonly sessionId: SessionId;
  readonly mountId: MountId;
};

const ENDED_TREE_PHASES: ReadonlyArray<string> = ['finished', 'stopping', 'stopped'];

export const isMountInUse = ({ state, sessionId, mountId }: Params): boolean => {
  const isAgentOnIt = (state.sessionPhaseRuns?.[sessionId] ?? []).some((agent) => {
    if (agent.status !== 'running' && agent.status !== 'blocked') {
      return false;
    }
    const destination = state.agentTurnDestination?.[agent.id] ?? null;
    return destination !== null && destination.kind === 'mount' && destination.mountId === mountId;
  });
  if (isAgentOnIt) {
    return true;
  }
  return (state.autoTreeViews?.[sessionId] ?? []).some(
    ({ tree, delegations }) =>
      tree.stopState === 'none' &&
      !ENDED_TREE_PHASES.includes(tree.phase) &&
      (tree.primaryMountId === mountId ||
        delegations.some(
          (delegation) => textFieldOf({ source: delegation.target, key: 'mountId' }) === mountId,
        )),
  );
};
