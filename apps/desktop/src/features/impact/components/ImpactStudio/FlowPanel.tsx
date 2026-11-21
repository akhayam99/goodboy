import type { AgentDurations, FlowHealth } from '@goodboy/db';
import type { SessionId } from '@goodboy/types';
import { StatCard, PaneShell, EmptyState, ErrorStrip, StatCardsSkeleton } from '@goodboy/ui';
import type { QueryResult } from '../../../../shared/types/queryResult';
import { formatHours } from '../../utils/formatHours';
import { SessionRows } from './SessionRows';
import { StudioWidget } from '@goodboy/ui';
import { CONCEPT_ICONS, CONCEPT_TONE } from '../../../../shared/components/conceptIcons';
import { NOT_LOADED_HINT, UNKNOWN_VALUE } from '../../../../shared/utils/unknownValue';
import type { PaneFrame } from '../../../../shared/types/paneFrame';
import { failedReadsOf } from '../../../../shared/utils/failedReadsOf';

const FLOW_TILE_LABELS = [
  'Median wall-clock',
  'Wait on you',
  'Blocked on a question',
  'Failed steps',
] as const;

type Props = {
  readonly frame: PaneFrame;
  readonly agentDurations: QueryResult<AgentDurations>;
  readonly flowHealth: QueryResult<FlowHealth>;
  readonly isLoading: boolean;
  readonly onRetry: () => void;
  readonly onOpenSession: (sessionId: SessionId) => void;
};

export const FlowPanel = ({
  frame,
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
  const failed = failedReadsOf({
    reads: [
      { label: 'agent duration', error: agentDurations.error },
      { label: 'flow health', error: flowHealth.error },
    ],
  });
  return (
    <PaneShell scroll="body" page="impact" {...frame}>
      <ErrorStrip labels={failed.labels} error={failed.error} onRetry={onRetry} />
      {isLoading && agents === null && health === null ? (
        <StatCardsSkeleton label="Loading impact metrics" />
      ) : null}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {health === null ? (
          FLOW_TILE_LABELS.map((label) => (
            <StatCard key={label} label={label} value={UNKNOWN_VALUE} hint={NOT_LOADED_HINT} />
          ))
        ) : (
          <>
            <StatCard
              label="Median wall-clock"
              value={formatHours({ hours: health.medianSessionHours })}
              hint={`p90 ${formatHours({ hours: health.p90SessionHours })}`}
            />
            <StatCard
              label="Wait on you"
              value={formatHours({ hours: health.medianQuestionHours })}
              hint={`${health.answeredQuestions} answered`}
            />
            <StatCard
              label="Blocked on a question"
              value={String(health.questionBlockedSessions)}
              hint={`${health.staleQuestions} over 24h`}
            />
            <StatCard
              label="Failed steps"
              value={String(health.failedAgents)}
              hint={`${health.budgetAlerts} budget alerts`}
            />
          </>
        )}
      </div>
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <StudioWidget
          label="Agent duration by kind"
          hint={agents === null ? NOT_LOADED_HINT : `${agents.totalAgents} completed agents`}
        >
          <div className="flex flex-col gap-1">
            {agents?.byKind.map((entry) => (
              <div
                key={entry.kind}
                className="grid grid-cols-[1fr_auto_auto] items-center gap-4 rounded-md px-2 py-2 text-meta"
              >
                <span className="capitalize text-foreground">{entry.kind}</span>
                <span className="tabular-nums text-muted-foreground">
                  median {formatHours({ hours: entry.medianHours })}
                </span>
                <span className="tabular-nums text-muted-foreground">
                  p90 {formatHours({ hours: entry.p90Hours })}
                </span>
              </div>
            ))}
            {agents !== null && agents.byKind.length === 0 ? (
              <EmptyState
                size="section"
                icon={CONCEPT_ICONS.agents}
                tone={CONCEPT_TONE.agents}
                title="No completed agents in this window"
              />
            ) : null}
          </div>
        </StudioWidget>
        <StudioWidget label="Where flow blocks" hint="Active blockers in this workspace">
          <div className="flex flex-col gap-3">
            <div className="flex items-center gap-3">
              <span className="min-w-0 flex-1 text-meta">Waiting on open questions</span>
              <span className="text-body tabular-nums">
                {countOrUnknown(health?.questionBlockedSessions)}
              </span>
            </div>
            <div className="flex items-center gap-3">
              <span className="min-w-0 flex-1 text-meta">Failed run agents</span>
              <span className="text-body tabular-nums">{countOrUnknown(health?.failedAgents)}</span>
            </div>
            <div className="flex items-center gap-3">
              <span className="min-w-0 flex-1 text-meta">Undismissed budget alerts</span>
              <span className="text-body tabular-nums">{countOrUnknown(health?.budgetAlerts)}</span>
            </div>
          </div>
        </StudioWidget>
      </div>
      <StudioWidget label="Slowest sessions" hint="Wall-clock from creation to latest activity">
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
