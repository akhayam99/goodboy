import { useMemo } from 'react';
import type { AgentId, SessionId } from '@goodboy/types';
import { EMPTY_ARRAY, useAppStore } from '../../../store';
import { autoTreeOfAgent, type AutoTreeOfAgent } from '../autoTreeOfAgent';
import { useAutoTreeViews } from '../useAutoTreeViews';
import { railRowsOf, restingRootRowOf, type RailRow } from '../chat/railRowsOf';

type Params = {
  readonly sessionId: SessionId;
  readonly agentId: AgentId | null;
};

export type AutoTreeRowsModel = Readonly<{
  tree: AutoTreeOfAgent | null;
  rows: ReadonlyArray<RailRow>;
  rootAgentId: AgentId | null;
}>;

export const useAutoTreeRows = ({ sessionId, agentId }: Params): AutoTreeRowsModel => {
  const views = useAutoTreeViews({ sessionId });
  const agents = useAppStore((state) => state.sessionPhaseRuns[sessionId] ?? EMPTY_ARRAY);
  const tree = useMemo(
    () => (agentId === null ? null : autoTreeOfAgent({ views, agentId })),
    [views, agentId],
  );
  const rootAgentId = tree?.view.tree.rootAgentId ?? agentId;
  const provider = useAppStore((state) =>
    rootAgentId === null ? null : (state.agentProviderOverride[rootAgentId] ?? null),
  );
  const model = useAppStore((state) =>
    rootAgentId === null ? null : (state.agentModelOverride[rootAgentId] ?? null),
  );
  const effort = useAppStore((state) =>
    rootAgentId === null ? null : (state.agentEffortOverride[rootAgentId] ?? null),
  );
  const rootTurn = useAppStore((state) =>
    rootAgentId === null ? null : (state.agentTurnState[rootAgentId] ?? null),
  );
  const rows = useMemo(() => {
    if (tree !== null) {
      return railRowsOf({
        view: tree.view,
        agents,
        rootRouting: { provider, model, effort },
        rootTurn,
      });
    }
    if (rootAgentId === null) {
      return [];
    }
    return [restingRootRowOf({ agentId: rootAgentId, provider, model, effort })];
  }, [tree, agents, rootAgentId, provider, model, effort, rootTurn]);
  return { tree, rows, rootAgentId };
};
