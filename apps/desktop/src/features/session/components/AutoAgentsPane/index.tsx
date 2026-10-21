import { useMemo } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { Plus } from 'lucide-react';
import { Button, EmptyState, PaneShell } from '@goodboy/ui';
import type { Agent, AgentId, Session } from '@goodboy/types';
import { EMPTY_ARRAY, useAppStore } from '../../../../store';
import { openSpawned } from '../../openSpawned';
import { autoRootsOf } from '../../../auto/autoRootsOf';
import { railRowsOf, restingRootRowOf, type RailRow } from '../../../auto/chat/railRowsOf';
import { useAutoTrees } from '../../../auto/useAutoTrees';
import { useIsAutoOn } from '../../../auto/useIsAutoOn';
import { openAutoForm } from '../../../auto/openAutoForm';
import { CONCEPT_ICONS, ICON_SIZE } from '../../../../shared/components/conceptIcons';
import { NAMES } from '../../../../shared/names';
import { AutoTreeRow } from './AutoTreeRow';
import { RunWorkTime } from '../AgentTree/RunWorkTime';
import { SessionPageIntro } from '../SessionPageIntro';

type Props = {
  readonly session: Session;
};

const EMPTY_TITLE = 'No Auto agents yet';

export const AutoAgentsPane = ({ session }: Props) => {
  const sessionId = session.id;
  const views = useAutoTrees({ sessionId });
  const agents = useAppStore((state) => state.sessionPhaseRuns[sessionId] ?? EMPTY_ARRAY);
  const kindOverride = useAppStore((state) => state.agentKindOverride);
  const providers = useAppStore((state) => state.agentProviderOverride);
  const models = useAppStore((state) => state.agentModelOverride);
  const efforts = useAppStore((state) => state.agentEffortOverride);
  const isAutoOn = useIsAutoOn();
  const roots = useMemo(() => autoRootsOf({ agents, kindOverride }), [agents, kindOverride]);
  const turnStates = useAppStore(
    useShallow((state) => roots.map((root) => state.agentTurnState[root.id] ?? null)),
  );
  const rows = useMemo(
    () =>
      roots.map((agent, index): Readonly<{ agent: Agent; row: RailRow; ask: string | null }> => {
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
        return {
          agent,
          row: root ?? restingRootRowOf({ agentId: agent.id, ...routing }),
          ask: view?.rootAsk ?? null,
        };
      }),
    [roots, views, agents, providers, models, efforts, turnStates],
  );

  const open = (agentId: AgentId) =>
    openSpawned({ sessionId, target: { kind: 'auto-root', agentId } });

  const hasRows = rows.length > 0;
  const start = () => openAutoForm({ sessionId });

  return (
    <RunWorkTime sessionId={sessionId} workspaceId={session.workspaceId}>
      <PaneShell
        page="auto"
        title={NAMES.autoAgents}
        subheader={<SessionPageIntro page="auto" />}
        actions={
          hasRows && isAutoOn ? (
            <Button variant="secondary" size="sm" onClick={start}>
              <Plus size={ICON_SIZE.row} aria-hidden className="shrink-0" />
              {NAMES.startAuto}
            </Button>
          ) : null
        }
      >
        {hasRows ? (
          <ul aria-label={NAMES.autoAgents} className="flex flex-col">
            {rows.map(({ agent, row, ask }) => (
              <AutoTreeRow
                key={agent.id}
                agent={agent}
                row={row}
                ask={ask}
                onOpen={() => open(agent.id)}
              />
            ))}
          </ul>
        ) : (
          <EmptyState
            size="page"
            icon={CONCEPT_ICONS.auto}
            title={EMPTY_TITLE}
            action={
              isAutoOn ? (
                <Button variant="primary" size="sm" onClick={start}>
                  <Plus size={ICON_SIZE.row} aria-hidden className="shrink-0" />
                  {NAMES.startAuto}
                </Button>
              ) : null
            }
          />
        )}
      </PaneShell>
    </RunWorkTime>
  );
};
