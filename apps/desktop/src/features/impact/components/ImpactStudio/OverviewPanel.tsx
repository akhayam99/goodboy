import type { ImpactOverview, PullRequestOutcomes, ReviewOutcomes } from '@goodboy/db';
import type { SessionId } from '@goodboy/types';
import { EmptyState } from '@goodboy/ui';
import { CONCEPT_ICONS } from '../../../../shared/components/conceptIcons';
import type { QueryResult } from '../../hooks/useImpactMetrics';
import { formatHours } from '../../utils/formatHours';
import { ErrorStrip } from './ErrorStrip';
import { PanelLoading } from './PanelLoading';
import { StudioPanel } from '../../../../shared/components/StudioPanel';
import { SessionRows } from './SessionRows';
import { TrendStatCard } from './TrendStatCard';
import { StudioWidget } from '../../../../shared/components/StudioWidget';

type Props = {
  readonly overview: QueryResult<ImpactOverview>;
  readonly pullRequests: QueryResult<PullRequestOutcomes>;
  readonly reviews: QueryResult<ReviewOutcomes>;
  readonly isLoading: boolean;
  readonly onRetryOverview: () => void;
  readonly onRetryShipped: () => void;
  readonly onOpenSession: (sessionId: SessionId) => void;
};

export const OverviewPanel = ({
  overview,
  pullRequests,
  reviews,
  isLoading,
  onRetryOverview,
  onRetryShipped,
  onOpenSession,
}: Props) => {
  const data = overview.data;
  const pullRequestData = pullRequests.data;
  const reviewData = reviews.data;
  const share =
    data !== null && data.sessionCount > 0
      ? (data.orchestratedSessions / data.sessionCount) * 100
      : 0;
  const previousShare =
    data?.previousSessionCount != null && data.previousSessionCount > 0
      ? ((data.previousOrchestratedSessions ?? 0) / data.previousSessionCount) * 100
      : null;
  return (
    <StudioPanel
      title="Overview"
      subtitle="What orchestration shipped and how quickly work reached done"
      maxWidthClass="max-w-5xl"
    >
      <ErrorStrip label="overview" error={overview.error} onRetry={onRetryOverview} />
      <ErrorStrip
        label="pull request outcomes"
        error={pullRequests.error}
        onRetry={onRetryShipped}
      />
      <ErrorStrip label="review outcomes" error={reviews.error} onRetry={onRetryShipped} />
      {isLoading && data === null ? <PanelLoading /> : null}
      {data !== null && data.sessionCount === 0 ? (
        <EmptyState
          icon={CONCEPT_ICONS.impact}
          title="No activity in this window"
          description="Run sessions to see shipped outcomes, flow time, and efficiency."
          bordered
        />
      ) : null}
      {data !== null && data.sessionCount > 0 ? (
        <>
          <div className="rounded-lg border border-success/30 bg-success/10 px-5 py-4 text-sm text-foreground">
            Orchestration shaped {data.orchestratedSessions} of {data.sessionCount} sessions (
            {Math.round(share)}%) in this window.
          </div>
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
            <TrendStatCard
              label="orchestrated"
              value={`${Math.round(share)}%`}
              current={share}
              previous={previousShare}
              onClick={
                data.sessions[0] !== undefined
                  ? () => onOpenSession(data.sessions[0]!.sessionId)
                  : undefined
              }
            />
            <TrendStatCard
              label="PRs open / merged"
              value={`${pullRequestData?.open ?? 0} / ${pullRequestData?.merged ?? 0}`}
              current={(pullRequestData?.open ?? 0) + (pullRequestData?.merged ?? 0)}
              previous={
                pullRequestData?.previousOpen == null || pullRequestData.previousMerged == null
                  ? null
                  : pullRequestData.previousOpen + pullRequestData.previousMerged
              }
              onClick={
                pullRequestData?.entries[0] !== undefined
                  ? () => onOpenSession(pullRequestData.entries[0]!.sessionId)
                  : undefined
              }
            />
            <TrendStatCard
              label="reviews resolved"
              value={String(reviewData?.commentsResolved ?? 0)}
              current={reviewData?.commentsResolved ?? 0}
              previous={reviewData?.previousCommentsResolved ?? null}
              onClick={
                reviewData?.sessions[0] !== undefined
                  ? () => onOpenSession(reviewData.sessions[0]!.sessionId)
                  : undefined
              }
            />
            <TrendStatCard
              label="median wall-clock"
              value={formatHours({ hours: data.medianSessionHours })}
              current={data.medianSessionHours ?? 0}
              previous={data.previousMedianSessionHours}
              lowerIsBetter
              onClick={
                data.sessions[0] !== undefined
                  ? () => onOpenSession(data.sessions[0]!.sessionId)
                  : undefined
              }
            />
          </div>
          <StudioWidget label="longest session wall-clock" hint="open a session to inspect its run">
            <SessionRows
              sessions={data.sessions}
              valueLabel=""
              formatValue={(value) => formatHours({ hours: value })}
              onOpenSession={onOpenSession}
            />
          </StudioWidget>
        </>
      ) : null}
    </StudioPanel>
  );
};
