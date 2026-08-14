import type { ImpactOverview, PullRequestOutcomes, ReviewOutcomes } from '@goodboy/db';
import type { SessionId } from '@goodboy/types';
import { EmptyState, formatUsd, formatUsdPrecise } from '@goodboy/ui';
import { CONCEPT_ICONS, CONCEPT_TONE } from '../../../../shared/components/conceptIcons';
import { ErrorStrip } from '@goodboy/ui';
import { PanelLoading } from '@goodboy/ui';
import type { QueryResult } from '../../../../shared/types/queryResult';
import { formatHours } from '../../utils/formatHours';
import { StudioPanel } from '../../../../shared/components/StudioPanel';
import { SessionRows } from './SessionRows';
import { TrendStatCard } from './TrendStatCard';
import { StudioWidget } from '@goodboy/ui';

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
    >
      <ErrorStrip label="overview" error={overview.error} onRetry={onRetryOverview} />
      <ErrorStrip
        label="pull request outcomes"
        error={pullRequests.error}
        onRetry={onRetryShipped}
      />
      <ErrorStrip label="review outcomes" error={reviews.error} onRetry={onRetryShipped} />
      {isLoading && data === null ? <PanelLoading label="Loading impact metrics" /> : null}
      {data !== null && data.sessionCount === 0 ? (
        <EmptyState
          icon={CONCEPT_ICONS.impact}
          tone={CONCEPT_TONE.impact}
          title="No activity in this window"
          description="Run sessions to see shipped outcomes, flow time, and efficiency."
          bordered
          size="lg"
          headingLevel={2}
        />
      ) : null}
      {data !== null && data.sessionCount > 0 ? (
        <>
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
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <StudioWidget
              label="longest session wall-clock"
              hint="open a session to inspect its run"
            >
              <SessionRows
                sessions={data.sessions}
                valueLabel=""
                formatValue={(value) => formatHours({ hours: value })}
                onOpenSession={onOpenSession}
              />
            </StudioWidget>
            <StudioWidget label="spend this window" hint="highest-cost sessions">
              {data.spendUsd === null ? (
                <span className="text-xs text-muted-foreground">
                  No spend recorded in this window
                </span>
              ) : (
                <div className="flex flex-col gap-3">
                  <div
                    title={formatUsdPrecise(data.spendUsd)}
                    className="font-mono text-2xl tabular-nums text-foreground"
                  >
                    {formatUsd(data.spendUsd)}
                  </div>
                  <SessionRows
                    sessions={data.spendSessions}
                    valueLabel=""
                    formatValue={(value) => formatUsd(value)}
                    onOpenSession={onOpenSession}
                  />
                </div>
              )}
            </StudioWidget>
          </div>
        </>
      ) : null}
    </StudioPanel>
  );
};
