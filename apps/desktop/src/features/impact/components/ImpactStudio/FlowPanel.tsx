import type { AgentDurations, FlowHealth } from '@goodboy/db';
import type { SessionId } from '@goodboy/types';
import { EmptyState, StatCard } from '@goodboy/ui';
import type { QueryResult } from '../../hooks/useImpactMetrics';
import { formatHours } from '../../utils/formatHours';
import { ErrorStrip } from './ErrorStrip';
import { PanelLoading } from './PanelLoading';
import { StudioPanel } from '../../../../shared/components/StudioPanel';
import { SessionRows } from './SessionRows';
import { StudioWidget } from '../../../../shared/components/StudioWidget';
import { CONCEPT_ICONS } from '../../../../shared/components/conceptIcons';

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
  return (
    <StudioPanel
      title="Flow"
      subtitle="How quickly work moves and where it waits"
      maxWidthClass="max-w-5xl"
    >
      <ErrorStrip label="agent duration" error={agentDurations.error} onRetry={onRetry} />
      <ErrorStrip label="flow health" error={flowHealth.error} onRetry={onRetry} />
      {isLoading && agents === null && health === null ? <PanelLoading /> : null}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard
          label="median wall-clock"
          value={formatHours({ hours: health?.medianSessionHours ?? null })}
          hint={`p90 ${formatHours({ hours: health?.p90SessionHours ?? null })}`}
        />
        <StatCard
          label="wait on human"
          value={formatHours({ hours: health?.medianQuestionHours ?? null })}
          hint={`${health?.answeredQuestions ?? 0} answered`}
        />
        <StatCard
          label="question blocked"
          value={String(health?.questionBlockedSessions ?? 0)}
          hint={`${health?.staleQuestions ?? 0} over 24h`}
        />
        <StatCard
          label="failed steps"
          value={String(health?.failedAgents ?? 0)}
          hint={`${health?.budgetAlerts ?? 0} budget alerts`}
        />
      </div>
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <StudioWidget
          label="agent duration by kind"
          hint={`${agents?.totalAgents ?? 0} completed agents`}
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
                title="No completed agents in this window"
                className="items-start px-0 py-0 text-left"
              />
            ) : null}
          </div>
        </StudioWidget>
        <StudioWidget label="where flow blocks" hint="active blockers in this workspace">
          <div className="flex flex-col gap-3">
            <div className="flex items-center gap-3">
              <span className="min-w-0 flex-1 text-xs">Waiting on open questions</span>
              <span className="font-mono text-sm tabular-nums">
                {health?.questionBlockedSessions ?? 0}
              </span>
            </div>
            <div className="flex items-center gap-3">
              <span className="min-w-0 flex-1 text-xs">Failed workflow agents</span>
              <span className="font-mono text-sm tabular-nums">{health?.failedAgents ?? 0}</span>
            </div>
            <div className="flex items-center gap-3">
              <span className="min-w-0 flex-1 text-xs">Undismissed budget alerts</span>
              <span className="font-mono text-sm tabular-nums">{health?.budgetAlerts ?? 0}</span>
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
    </StudioPanel>
  );
};
