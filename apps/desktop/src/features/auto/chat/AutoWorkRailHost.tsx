import { useMemo, useState, type ReactNode } from 'react';
import type { Agent, Session } from '@goodboy/types';
import { EMPTY_ARRAY, useAppStore } from '../../../store';
import { autoTreeOfAgent } from '../autoTreeOfAgent';
import { useAutoTrees } from '../useAutoTrees';
import { AutoWorkRail } from './AutoWorkRail';
import { railRowsOf } from './railRowsOf';
import { useAutoTreeActions } from './useAutoTreeActions';

type Props = {
  readonly session: Session;
  readonly agent: Agent;
  readonly children: ReactNode;
};

export const AutoWorkRailHost = ({ session, agent, children }: Props) => {
  const views = useAutoTrees({ sessionId: session.id });
  const agents = useAppStore((state) => state.sessionPhaseRuns[session.id] ?? EMPTY_ARRAY);
  const tree = useMemo(() => autoTreeOfAgent({ views, agentId: agent.id }), [views, agent.id]);
  const rootId = tree?.view.tree.rootAgentId ?? null;
  const provider = useAppStore((state) =>
    rootId === null ? null : (state.agentProviderOverride[rootId] ?? null),
  );
  const model = useAppStore((state) =>
    rootId === null ? null : (state.agentModelOverride[rootId] ?? null),
  );
  const effort = useAppStore((state) =>
    rootId === null ? null : (state.agentEffortOverride[rootId] ?? null),
  );
  const actions = useAutoTreeActions({ sessionId: session.id });
  const [isCollapsed, setIsCollapsed] = useState(false);
  const rows = useMemo(
    () =>
      tree === null
        ? []
        : railRowsOf({ view: tree.view, agents, rootRouting: { provider, model, effort } }),
    [tree, agents, provider, model, effort],
  );

  if (tree === null || rows.length < 2) {
    return children;
  }
  return (
    <div className="flex min-h-0 min-w-0 flex-1">
      <AutoWorkRail
        rows={rows}
        budget={tree.view.budget}
        selectedAgentId={agent.id}
        isCollapsed={isCollapsed}
        onToggleCollapsed={() => setIsCollapsed((isNow) => !isNow)}
        onOpen={(row) => actions.openAgent(row.agentId)}
      />
      <div className="flex min-h-0 min-w-0 flex-1 flex-col">{children}</div>
    </div>
  );
};
