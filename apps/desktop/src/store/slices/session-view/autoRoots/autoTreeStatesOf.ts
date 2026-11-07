import type { Agent, Session } from '@goodboy/types';
import { autoGroupOf } from '../../../../features/auto/autoGroupOf';
import { autoRootsOf } from '../../../../features/auto/autoRootsOf';
import { autoTreeWordOf, type AutoTreeState } from '../../../../features/auto/autoTreeWordOf';
import { liveAutoViewsOf } from '../../../../features/auto/liveAutoViewsOf';
import type { AutoWaitState } from './autoWaitRootsOf';

export type AutoTreeStateEntry = Readonly<{
  root: Agent;
  state: AutoTreeState;
  isStuck: boolean;
}>;

type Params = {
  readonly state: AutoWaitState;
  readonly session: Session;
  readonly agents: ReadonlyArray<Agent>;
};

const NO_CLOCK = 0;

export const autoTreeStatesOf = ({
  state,
  session,
  agents,
}: Params): ReadonlyArray<AutoTreeStateEntry> => {
  const views = liveAutoViewsOf({
    views: state.autoTreeViews?.[session.id] ?? [],
    agents,
  });
  if (views.length === 0) {
    return [];
  }
  const now = state.autoClockAt ?? NO_CLOCK;
  return autoRootsOf({ agents, kindOverride: state.agentKindOverride ?? {} }).flatMap((root) => {
    const view = views.find((candidate) => candidate.tree.rootAgentId === root.id);
    if (view === undefined) {
      return [];
    }
    const tree = autoTreeWordOf({ view, rootTurn: state.agentTurnState[root.id] ?? null });
    return [
      {
        root,
        state: tree.state,
        isStuck: autoGroupOf({ view, agents, now })?.isStuck === true,
      },
    ];
  });
};
