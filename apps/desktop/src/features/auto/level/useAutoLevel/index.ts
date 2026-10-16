import { useMemo } from 'react';
import type { AgentId, Session } from '@goodboy/types';
import { EMPTY_ARRAY, useAppStore } from '../../../../store';
import { autoTreeOfAgent, type AutoTreeOfAgent } from '../../autoTreeOfAgent';
import { useAutoTreeViews } from '../../useAutoTreeViews';
import { railRowsOf, restingRootRowOf, type RailRow } from '../../chat/railRowsOf';

type Params = {
  readonly session: Session;
};

export type AutoLevelModel = Readonly<{
  tree: AutoTreeOfAgent | null;
  rows: ReadonlyArray<RailRow>;
  rootAgentId: AgentId | null;
  shownAgentId: AgentId | null;
}>;

export const useAutoLevel = ({ session }: Params): AutoLevelModel => {
  const sessionId = session.id;
  const views = useAutoTreeViews({ sessionId });
  const agents = useAppStore((state) => state.sessionPhaseRuns[sessionId] ?? EMPTY_ARRAY);
  const selectedAgentId = useAppStore((state) => state.selectedAgentId[sessionId] ?? null);
  const paneAgentId = useAppStore((state) =>
    state.drawer?.kind === 'auto-child' && state.drawer.sessionId === sessionId
      ? state.drawer.payload.agentId
      : null,
  );
  const tree = useMemo(
    () => (selectedAgentId === null ? null : autoTreeOfAgent({ views, agentId: selectedAgentId })),
    [views, selectedAgentId],
  );
  const rootAgentId = tree?.view.tree.rootAgentId ?? selectedAgentId;
  const provider = useAppStore((state) =>
    rootAgentId === null ? null : (state.agentProviderOverride[rootAgentId] ?? null),
  );
  const model = useAppStore((state) =>
    rootAgentId === null ? null : (state.agentModelOverride[rootAgentId] ?? null),
  );
  const effort = useAppStore((state) =>
    rootAgentId === null ? null : (state.agentEffortOverride[rootAgentId] ?? null),
  );
  const rows = useMemo(() => {
    if (tree !== null) {
      return railRowsOf({ view: tree.view, agents, rootRouting: { provider, model, effort } });
    }
    if (rootAgentId === null) {
      return [];
    }
    return [restingRootRowOf({ agentId: rootAgentId, provider, model, effort })];
  }, [tree, agents, rootAgentId, provider, model, effort]);
  return { tree, rows, rootAgentId, shownAgentId: paneAgentId ?? selectedAgentId };
};
