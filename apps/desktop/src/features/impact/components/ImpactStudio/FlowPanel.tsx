import type { AgentDurations, FlowHealth } from '@goodboy/db';
import type { SessionId } from '@goodboy/types';
import { EmptyState, StatCard } from '@goodboy/ui';
import { ErrorStrip } from '@goodboy/ui';
import { PanelLoading } from '@goodboy/ui';
import type { QueryResult } from '../../../../shared/types/queryResult';
import { formatHours } from '../../utils/formatHours';
import { PaneShell } from '../../../../shared/components/PaneShell';
import { SessionRows } from './SessionRows';
import { StudioWidget } from '@goodboy/ui';
import { CONCEPT_ICONS, CONCEPT_TONE } from '../../../../shared/components/conceptIcons';
import { NOT_LOADED_HINT, UNKNOWN_VALUE } from '../../../../shared/utils/unknownValue';

const FLOW_TILE_LABELS = [
  'median wall-clock',
  'wait on human',
  'question blocked',
  'failed steps',
] as const;

type Props = {
  readonly agentDurations: QueryResult<AgentDurations>;
  readonly flowHealth: QueryResult<FlowHealth>;
  readonly isLoading: boolean;
  readonly onRetry: () => void;
  readonly onOpenSession: (sessionId: SessionId) => void;
};

export const FlowPanel = ({
  agentDurations,
  flowHealth,
  isLoading,
  onRetry,
  onOpenSession,
}: Props) => {
  const agents = agentDurations.data;
  const health = flowHealth.data;
  const countOrUnknown = (value: number | undefined): string =>
    value === undefined ? UNKNOWN_VALUE : String(value);
  return (
    <PaneShell scroll="body" title="Flow">
      <ErrorStrip label="agent duration" error={agentDurations.error} onRetry={onRetry} />
      <ErrorStrip label="flow health" error={flowHealth.error} onRetry={onRetry} />
      {isLoading && agents === null && health === null ? (
        <PanelLoading label="Loading impact metrics" />
      ) : null}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {health === null ? (
          FLOW_TILE_LABELS.map((label) => (
            <StatCard key={label} label={label} value={UNKNOWN_VALUE} hint={NOT_LOADED_HINT} />
          ))
        ) : (
          <>
            <StatCard
              label="median wall-clock"
              value={formatHours({ hours: health.medianSessionHours })}
              hint={`p90 ${formatHours({ hours: health.p90SessionHours })}`}
            />
            <StatCard
              label="wait on human"
              value={formatHours({ hours: health.medianQuestionHours })}
              hint={`${health.answeredQuestions} answered`}
            />
            <StatCard
              label="question blocked"
              value={String(health.questionBlockedSessions)}
              hint={`${health.staleQuestions} over 24h`}
            />
            <StatCard
              label="failed steps"
              value={String(health.failedAgents)}
              hint={`${health.budgetAlerts} budget alerts`}
            />
          </>
        )}
      </div>
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <StudioWidget
          label="agent duration by kind"
          hint={agents === null ? NOT_LOADED_HINT : `${agents.totalAgents} completed agents`}
        >
          <div className="flex flex-col gap-1">
            {agents?.byKind.map((entry) => (
              <div
                key={entry.kind}
                className="grid grid-cols-[1fr_auto_auto] items-center gap-4 rounded-md px-2 py-1.5 text-xs"
              >
                <span className="capitalize text-foreground">{entry.kind}</span>
                <span className="font-mono tabular-nums text-muted-foreground">
                  median {formatHours({ hours: entry.medianHours })}
                </span>
                <span className="font-mono tabular-nums text-muted-foreground">
                  p90 {formatHours({ hours: entry.p90Hours })}
                </span>
              </div>
            ))}
            {agents !== null && agents.byKind.length === 0 ? (
              <EmptyState
                icon={CONCEPT_ICONS.agents}
                tone={CONCEPT_TONE.agents}
                title="No completed agents in this window"
                size="inline"
              />
            ) : null}
          </div>
        </StudioWidget>
        <StudioWidget label="where flow blocks" hint="active blockers in this workspace">
          <div className="flex flex-col gap-3">
            <div className="flex items-center gap-3">
              <span className="min-w-0 flex-1 text-xs">Waiting on open questions</span>
              <span className="font-mono text-sm tabular-nums">
                {countOrUnknown(health?.questionBlockedSessions)}
              </span>
            </div>
            <div className="flex items-center gap-3">
              <span className="min-w-0 flex-1 text-xs">Failed workflow agents</span>
              <span className="font-mono text-sm tabular-nums">
                {countOrUnknown(health?.failedAgents)}
              </span>
            </div>
            <div className="flex items-center gap-3">
              <span className="min-w-0 flex-1 text-xs">Undismissed budget alerts</span>
              <span className="font-mono text-sm tabular-nums">
                {countOrUnknown(health?.budgetAlerts)}
              </span>
            </div>
          </div>
        </StudioWidget>
      </div>
      <StudioWidget label="slowest sessions" hint="wall-clock from creation to latest activity">
        <SessionRows
          sessions={health?.sessions ?? []}
          valueLabel=""
          formatValue={(value) => formatHours({ hours: value })}
          onOpenSession={onOpenSession}
        />
      </StudioWidget>
    </PaneShell>
  );
};
