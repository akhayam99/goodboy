import type { ProviderRunId, TelemetryRecord } from '@goodboy/types';
import { formatTokens, formatUsd } from '@goodboy/ui';
import { EMPTY_ARRAY, useAppStore } from '../../../../../../store';
import { AgentKindChip } from '../../../../../../shared/components/AgentKindChip';
import { formatClock } from '../../../../../../shared/utils/time/formatClock';
import type { RowPhase } from '../../../../../workTreeModel/rowState';
import { routingLabelModel } from '../../../../../../shared/components/RoutingLabel/routingLabelModel';
import type { AgentRowWork } from '../../../../hooks/useAgentRowWork';
import { agentTokenTotals } from '../../../../timeline/agentTokenTotals';
import type { TimelineAgentEntry } from '../../../../timeline/buildTimelineGroups';
import type { AgentModels } from '../../../../timeline/ranModels';
import { RowCardFacts, type RowCardFact } from './RowCardFacts';
import { RowCardHeader } from './RowCardHeader';
import { useRowPosition } from './useRowPosition';

type Props = {
  readonly entry: TimelineAgentEntry;
  readonly ordinal: string | null;
  readonly kindWord: string;
  readonly models: AgentModels;
  readonly work: AgentRowWork;
  readonly phase: RowPhase;
  readonly costUsd: number;
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
  const facts: Array<RowCardFact> = [];
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
      value: `${formatTokens(tokens.input)} in · ${formatTokens(tokens.output)} out · ${formatTokens(tokens.cached)} cached`,
    });
  }
  if (costUsd > 0) {
    facts.push({ label: 'Cost', value: formatUsd(costUsd) });
  }
  return (
    <span className="flex flex-col gap-2">
      <RowCardHeader
        glyph={<AgentKindChip kind={entry.agentKind} density="glyph" isDecorative />}
        title={kindWord}
        sub={position}
      />
      {last === null ? null : (
        <span className="text-body text-foreground">
          {last.effort === null ? last.name : `${last.name} · ${last.effort}`}
        </span>
      )}
      {divergence === null ? null : (
        <span className="text-meta text-muted-foreground">{divergence}</span>
      )}
      <RowCardFacts facts={facts} />
    </span>
  );
};
