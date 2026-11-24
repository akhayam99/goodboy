import type { ProviderRunId, TelemetryRecord } from '@goodboy/types';
import { FactCard, WorkNode } from '@goodboy/ui';
import { useAppStore } from '../../../../store';
import { AgentKindChip } from '../../../../shared/components/AgentKindChip';
import { routingLabelModel } from '../../../../shared/components/RoutingLabel/routingLabelModel';
import { useNow } from '../../../../shared/hooks/useNow';
import { agentDisplayName } from '../../../../shared/utils/agentDisplayName';
import type { AgentRowWork } from '../../../session/hooks/useAgentRowWork';
import { TimelineProviderGlyph } from '../../../session/components/SessionWorkspace/parts/TimelinePane/TimelineProviderGlyph';
import type { CardTrigger } from '../../../session/components/SessionWorkspace/parts/TimelinePane/timelineRowIdentity';
import { useRowPosition } from '../../../session/components/SessionWorkspace/parts/TimelinePane/useRowPosition';
import { agentTokenTotals } from '../../../session/timeline/agentTokenTotals';
import type { TimelineAgentEntry } from '../../../session/timeline/buildTimelineGroups';
import type { AgentModels } from '../../../session/timeline/ranModels';
import { roleCardSpec } from '../../roleCardSpec';
import type { RowPhase } from '../../rowState';
import { rowStateNode } from '../../rowStateCopy';

type Props = {
  readonly entry: TimelineAgentEntry;
  readonly ordinal: string | null;
  readonly kindWord: string;
  readonly models: AgentModels;
  readonly work: AgentRowWork;
  readonly phase: RowPhase;
  readonly costUsd: number;
  readonly isOpen?: boolean;
  readonly children: CardTrigger;
};

const EMPTY_RUN_IDS: ReadonlyArray<ProviderRunId> = [];

const NO_RECORDS: ReadonlyArray<TelemetryRecord> = [];

const MINUTE_MS = 60_000;

export const RoleCard = ({
  entry,
  ordinal,
  kindWord,
  models,
  work,
  phase,
  costUsd,
  isOpen = false,
  children,
}: Props) => {
  const { agent } = entry;
  const { routing, time } = work;
  const { divergence } = routingLabelModel({
    provider: routing.provider,
    model: routing.model,
    effort: routing.effort,
    planned: routing.isPlanned ? null : routing.planned,
    isEffortObserved: routing.isEffortObserved,
  });
  const records = useAppStore((state) => state.sessionTelemetry[agent.sessionId] ?? NO_RECORDS);
  const history = useAppStore((state) => state.agentRunHistory[agent.id] ?? EMPTY_RUN_IDS);
  const position = useRowPosition({ entry, ordinal });
  const nowMs = useNow(MINUTE_MS, phase === 'waiting');
  const runIds = agent.runId == null ? history : [...history, agent.runId];
  const node = rowStateNode({ state: { phase, reason: null, ask: null } });
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
        markOf: ({ provider }) => <TimelineProviderGlyph provider={provider} />,
        kindWord,
        position,
        task: agentDisplayName({ name: agent.name, kind: entry.agentKind }),
        phase,
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
