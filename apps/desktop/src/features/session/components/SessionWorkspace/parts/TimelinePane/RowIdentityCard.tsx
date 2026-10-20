import type { ProviderRunId, TelemetryRecord } from '@goodboy/types';
import { FactCard, formatTokens, formatUsd, type Fact } from '@goodboy/ui';
import { EMPTY_ARRAY, useAppStore } from '../../../../../../store';
import { AgentKindChip } from '../../../../../../shared/components/AgentKindChip';
import { formatClock } from '../../../../../../shared/utils/time/formatClock';
import type { RowPhase } from '../../../../../workTreeModel/rowState';
import { routingLabelModel } from '../../../../../../shared/components/RoutingLabel/routingLabelModel';
import type { AgentRowWork } from '../../../../hooks/useAgentRowWork';
import { agentTokenTotals } from '../../../../timeline/agentTokenTotals';
import type { TimelineAgentEntry } from '../../../../timeline/buildTimelineGroups';
import type { AgentModels } from '../../../../timeline/ranModels';
import type { CardTrigger } from './timelineRowIdentity';
import { useRowPosition } from './useRowPosition';

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

export const RowIdentityCard = ({
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
  const records = useAppStore(
    (state) =>
      state.sessionTelemetry[agent.sessionId] ?? (EMPTY_ARRAY as ReadonlyArray<TelemetryRecord>),
  );
  const history = useAppStore((state) => state.agentRunHistory[agent.id] ?? EMPTY_RUN_IDS);
  const position = useRowPosition({ entry, ordinal });
  const last = models.models[models.models.length - 1] ?? null;
  const runIds = agent.runId == null ? history : [...history, agent.runId];
  const tokens = agentTokenTotals({ records, runIds });
  const finishedAt = agent.completedAt ?? agent.lastFinishedAt ?? null;
  const facts: Array<Fact> = [];
  if (last !== null) {
    facts.push(
      last.effort === null
        ? { label: 'Model', value: last.name }
        : { label: 'Model', value: last.name, note: last.effort },
    );
  }
  if (agent.startedAt != null) {
    facts.push({ label: 'Started', value: formatClock({ at: agent.startedAt }) });
  }
  if (finishedAt !== null && phase !== 'running' && phase !== 'queued') {
    facts.push({ label: 'Finished', value: formatClock({ at: finishedAt }) });
  }
  if (time != null) {
    facts.push(
      phase === 'queued'
        ? { label: 'Estimate', value: time.label }
        : { label: 'Active', value: time.headline },
    );
  }
  if (tokens !== null) {
    facts.push({
      label: 'Tokens',
      value: `${formatTokens(tokens.input)} in, ${formatTokens(tokens.output)} out`,
      note: `${formatTokens(tokens.cached)} cached`,
    });
  }
  if (costUsd > 0) {
    facts.push({ label: 'Cost', value: formatUsd(costUsd) });
  }
  return (
    <FactCard
      isOpen={isOpen}
      card={{
        glyph: <AgentKindChip kind={entry.agentKind} density="glyph" isDecorative />,
        title: kindWord,
        sub: position,
        facts,
        ...(divergence === null ? {} : { footnote: divergence }),
      }}
    >
      {children}
    </FactCard>
  );
};
