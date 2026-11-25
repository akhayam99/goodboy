import type { Agent, SessionId } from '@goodboy/types';
import type { AutoWaitState } from './autoWaitRootsOf';

type Params = {
  readonly state: AutoWaitState;
  readonly sessionId: SessionId;
  readonly roots: ReadonlyArray<Agent>;
};

export const heldFirstRootsOf = ({ state, sessionId, roots }: Params): ReadonlyArray<Agent> => {
  const views = state.autoTreeViews?.[sessionId] ?? [];
  const heldIds = new Set(
    views.filter((view) => view.hold != null).map((view) => view.tree.rootAgentId),
  );
  return [
    ...roots.filter((root) => heldIds.has(root.id)),
    ...roots.filter((root) => !heldIds.has(root.id)),
  ];
};
