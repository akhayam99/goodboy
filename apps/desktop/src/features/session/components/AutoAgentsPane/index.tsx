import { useMemo } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { PaneShell } from '@goodboy/ui';
import type { Agent, AgentId, Session } from '@goodboy/types';
import { EMPTY_ARRAY, agentPlace, useAppStore } from '../../../../store';
import { autoRootsOf } from '../../../auto/autoRootsOf';
import { railRowsOf, restingRootRowOf, type RailRow } from '../../../auto/chat/railRowsOf';
import { useAutoTrees } from '../../../auto/useAutoTrees';
import { useIsAutoOn } from '../../../auto/useIsAutoOn';
import { AutoComposer } from '../AutoComposer';
import { AutoTreeRow } from './AutoTreeRow';
import { RunWorkTime } from '../AgentTree/RunWorkTime';

type Props = {
  readonly session: Session;
};

const START_HINT =
  'Ask Auto a question or give it a task. It answers itself, or starts the right agent.';

export const AutoAgentsPane = ({ session }: Props) => {
  const sessionId = session.id;
  const views = useAutoTrees({ sessionId });
  const agents = useAppStore((state) => state.sessionPhaseRuns[sessionId] ?? EMPTY_ARRAY);
  const kindOverride = useAppStore((state) => state.agentKindOverride);
  const providers = useAppStore((state) => state.agentProviderOverride);
  const models = useAppStore((state) => state.agentModelOverride);
  const efforts = useAppStore((state) => state.agentEffortOverride);
  const navigate = useAppStore((state) => state.navigate);
  const pickRailLevel = useAppStore((state) => state.pickRailLevel);
  const isAutoOn = useIsAutoOn();
  const roots = useMemo(() => autoRootsOf({ agents, kindOverride }), [agents, kindOverride]);
  const turnStates = useAppStore(
    useShallow((state) => roots.map((root) => state.agentTurnState[root.id] ?? null)),
  );
  const rows = useMemo(
    () =>
      roots.map((agent, index): Readonly<{ agent: Agent; row: RailRow }> => {
        const routing = {
          provider: providers[agent.id] ?? null,
          model: models[agent.id] ?? null,
          effort: efforts[agent.id] ?? null,
        };
        const view = views.find((candidate) => candidate.tree.rootAgentId === agent.id);
        const [root] =
          view === undefined
            ? []
            : railRowsOf({
                view,
                agents,
                rootRouting: routing,
                rootTurn: turnStates[index] ?? null,
              });
        return { agent, row: root ?? restingRootRowOf({ agentId: agent.id, ...routing }) };
      }),
    [roots, views, agents, providers, models, efforts, turnStates],
  );

  const open = (agentId: AgentId) => {
    navigate({ to: agentPlace({ sessionId, agentId }) });
    pickRailLevel({ level: 'auto' });
  };

  return (
    <RunWorkTime sessionId={sessionId} workspaceId={session.workspaceId}>
      <PaneShell page="auto" title="Auto agents">
        <div className="flex min-w-0 flex-col gap-6">
          {rows.length === 0 ? null : (
            <ul aria-label="Auto agents" className="flex flex-col">
              {rows.map(({ agent, row }) => (
                <AutoTreeRow key={agent.id} agent={agent} row={row} onOpen={() => open(agent.id)} />
              ))}
            </ul>
          )}
          {isAutoOn ? (
            <section aria-label="Start Auto" className="flex min-w-0 flex-col gap-3">
              <p className="text-prose text-muted-foreground">{START_HINT}</p>
              <AutoComposer sessionId={sessionId} onDone={() => undefined} />
            </section>
          ) : null}
        </div>
      </PaneShell>
    </RunWorkTime>
  );
};
