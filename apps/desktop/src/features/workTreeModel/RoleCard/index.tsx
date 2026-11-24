import type { ComponentProps } from 'react';
import type { ProviderRunId, TelemetryRecord } from '@goodboy/types';
import { FactCard, WorkNode } from '@goodboy/ui';
import { useAppStore } from '../../../store';
import { AgentKindChip } from '../../../shared/components/AgentKindChip';
import { routingLabelModel } from '../../../shared/components/RoutingLabel/routingLabelModel';
import { useNow } from '../../../shared/hooks/useNow';
import { agentDisplayName } from '../../../shared/utils/agentDisplayName';
import { agentTokenTotals } from '../../session/timeline/agentTokenTotals';
import type { AgentRowRouting } from '../../session/timeline/agentRowRouting';
import type { TimelineAgentEntry } from '../../session/timeline/buildTimelineGroups';
import type { AgentModels } from '../../session/timeline/ranModels';
import { roleCardSpec, type RoleCardParams } from '../roleCardSpec';
import type { RowState } from '../rowState';
import { rowStateNode } from '../rowStateCopy';
import type { WorkTime } from '../workTime';

type Props = {
  readonly entry: TimelineAgentEntry;
  readonly position: string;
  readonly kindWord: string;
  readonly models: AgentModels;
  readonly routing: AgentRowRouting;
  readonly time: WorkTime | null | undefined;
  readonly rowState: RowState;
  readonly costUsd: number;
  readonly markOf: RoleCardParams['markOf'];
  readonly isOpen?: boolean;
  readonly children: ComponentProps<typeof FactCard>['children'];
};

const EMPTY_RUN_IDS: ReadonlyArray<ProviderRunId> = [];

const NO_RECORDS: ReadonlyArray<TelemetryRecord> = [];

const MINUTE_MS = 60_000;

export const RoleCard = ({
  entry,
  position,
  kindWord,
  models,
  routing,
  time,
  rowState,
  costUsd,
  markOf,
  isOpen = false,
  children,
}: Props) => {
  const { agent } = entry;
  const { phase } = rowState;
  const { divergence } = routingLabelModel({
    provider: routing.provider,
    model: routing.model,
    effort: routing.effort,
    planned: routing.isPlanned ? null : routing.planned,
    isEffortObserved: routing.isEffortObserved,
  });
  const records = useAppStore((state) => state.sessionTelemetry[agent.sessionId] ?? NO_RECORDS);
  const history = useAppStore((state) => state.agentRunHistory[agent.id] ?? EMPTY_RUN_IDS);
  const nowMs = useNow(MINUTE_MS, phase === 'waiting');
  const runIds = agent.runId == null ? history : [...history, agent.runId];
  const isStopped = phase === 'waiting' && rowState.reason?.kind === 'agentStopped';
  const node = rowStateNode({ state: rowState });
  const askedAt = entry.openQuestions.reduce<string | null>(
    (latest, question) =>
      latest === null || question.createdAt > latest ? question.createdAt : latest,
    null,
  );
  return (
    <FactCard
      isOpen={isOpen}
      card={roleCardSpec({
        glyph: <AgentKindChip kind={entry.agentKind} density="glyph" isDecorative />,
        stateGlyph: (
          <WorkNode state={node.state} label={node.label} mark={{ kind: 'dot' }} size="sm" />
        ),
        markOf,
        kindWord,
        position,
        task: agentDisplayName({ name: agent.name, kind: entry.agentKind }),
        phase,
        isStopped,
        time,
        askedAt,
        nowMs,
        models,
        isEffortObserved: routing.isEffortObserved,
        startedAt: agent.startedAt ?? null,
        tokens: agentTokenTotals({ records, runIds }),
        costUsd,
        footnote: divergence,
      })}
    >
      {children}
    </FactCard>
  );
};
