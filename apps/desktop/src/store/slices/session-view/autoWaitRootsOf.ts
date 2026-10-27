import type { Agent, Session } from '@goodboy/types';
import { autoGroupOf } from '../../../features/auto/autoGroupOf';
import { autoRootsOf } from '../../../features/auto/autoRootsOf';
import { autoTreeWordOf } from '../../../features/auto/autoTreeWordOf';
import { liveAutoViewsOf } from '../../../features/auto/liveAutoViewsOf';
import type { AppState } from '../../types';
import type { AutoViewState } from '../auto-view/state';

export type AutoWaitState = Pick<AppState, 'agentTurnState'> &
  Partial<Pick<AppState, 'agentKindOverride'> & AutoViewState>;

type Params = {
  readonly state: AutoWaitState;
  readonly session: Session;
  readonly agents: ReadonlyArray<Agent>;
};

const NO_CLOCK = 0;

export const autoWaitRootsOf = ({ state, session, agents }: Params): ReadonlyArray<Agent> => {
  const views = liveAutoViewsOf({
    views: state.autoTreeViews?.[session.id] ?? [],
    agents,
  });
  if (views.length === 0) {
    return [];
  }
  return autoRootsOf({ agents, kindOverride: state.agentKindOverride ?? {} }).filter((root) => {
    const view = views.find((candidate) => candidate.tree.rootAgentId === root.id);
    if (view === undefined) {
      return false;
    }
    const { word } = autoTreeWordOf({ view, rootTurn: state.agentTurnState[root.id] ?? null });
    return word === 'Needs you' || autoGroupOf({ view, agents, now: NO_CLOCK })?.isStuck === true;
  });
};
